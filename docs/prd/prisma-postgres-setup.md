# Setup Prisma + PostgreSQL cho NestJS (ESM, deploy Docker VPS)

Stack: NestJS 12, ESM (`"type": "module"`), Postgres, `ConfigModule` + Zod đã setup sẵn, deploy Docker qua GitHub Actions lên VPS.

## 0. Cài đặt

```bash
npm i -D prisma
npm i @prisma/client @prisma/adapter-pg pg
```

`@prisma/adapter-pg` là **driver adapter** — bắt buộc phải có với generator `prisma-client` đời mới (không dùng ngầm định driver cũ như trước), cần khai báo tường minh khi khởi tạo `PrismaClient`.

## 1. Khởi tạo Prisma

```bash
npx prisma init --datasource-provider postgresql
```

Lệnh này tạo `prisma/schema.prisma` và `.env`.

### 1.1. `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  // KHÔNG set moduleFormat = "cjs" — project này là ESM,
  // để generator xuất ra ESM mặc định, khớp "type": "module"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  password  String
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User?    @relation(fields: [authorId], references: [id])
  authorId  Int?
}
```

### 1.2. Barrel file — 1 chỗ duy nhất import Prisma client

Vì `output` trỏ vào `src/generated/prisma` (thư mục tự sinh, sẽ bị ghi đè mỗi lần chạy `prisma generate`), **không import trực tiếp** từ đường dẫn generated ở nhiều nơi trong code — tạo 1 barrel file trung gian để dễ đổi path sau này:

```typescript
// src/prisma/prisma-client.ts
export { PrismaClient, Prisma } from '../generated/prisma/client.js';
```

Từ giờ, mọi nơi trong code (service, exception mapper...) chỉ import từ `src/prisma/prisma-client.ts`, không import thẳng `src/generated/prisma/...`.

---

## 2. Gắn `DATABASE_URL` vào `ConfigModule` (Zod) đã có

Prisma đọc `DATABASE_URL` qua `env()` ngay trong `schema.prisma`, nên biến này cần có mặt trong `process.env` lúc `prisma generate`/`migrate` chạy, **và** validate được bởi Zod schema đã setup trước đó.

```typescript
// src/config/env.validation.ts — thêm vào schema đã có
export const envSchema = z.object({
  // ...các field cũ (NODE_ENV, PORT...)
  DATABASE_URL: z.string().url('DATABASE_URL phải là 1 connection string hợp lệ'),
});
```

```bash
# .env (local dev)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp?schema=public"
```

> Nếu trước đó bạn từng tách `DATABASE_HOST`/`PORT`/`USER`/`PASSWORD`/`NAME` riêng lẻ trong `database.config.ts` — với Prisma nên **gộp lại thành 1 biến `DATABASE_URL` duy nhất**, vì Prisma CLI (`migrate`, `generate`) chỉ đọc được `DATABASE_URL`, không tự ráp từ các biến rời.

---

## 3. `PrismaService` — inject qua `ConfigService`, dùng driver adapter

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './prisma-client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: configService.get<string>('DATABASE_URL', { infer: true }),
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` để không phải import `PrismaModule` lặp lại ở từng feature module — inject `PrismaService` thẳng vào bất kỳ service nào.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
// ...các import config cũ

@Module({
  imports: [
    ConfigModule.forRoot({ /* ...cấu hình cũ đã có */ }),
    PrismaModule,
    // ...các feature module khác
  ],
})
export class AppModule {}
```

---

## 4. Dùng `PrismaService` trong service thật (nối vào setup exception đã có)

```typescript
// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/user.schema.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: CreateUserDto) {
    // không cần tự check trùng email thủ công nữa —
    // để Postgres unique constraint tự chặn, Prisma ném P2002,
    // PrismaErrorHandler (đã setup trước đó) tự convert thành 409 Conflict
    return this.prisma.user.create({
      data: {
        email: dto.email,
        password: dto.password, // nhớ hash trước khi lưu, xem lưu ý cuối file
        name: dto.name,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      // hoặc để Prisma tự ném P2025 nếu dùng .update()/.delete() thay vì findUnique
      throw new (await import('../common/exceptions/app.exception.js')).NotFoundAppException(
        'Không tìm thấy user',
      );
    }
    return user;
  }

  async list(params: { page: number; limit: number }) {
    const { page, limit } = params;
    return this.prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

## 5. Cập nhật `PrismaErrorHandler`/`mapper` đã setup trước đó — đổi import

Trước đây import `Prisma` từ `@prisma/client`. Vì giờ dùng custom `output` (`src/generated/prisma`), phải đổi sang import qua barrel file đã tạo ở mục 1.2:

```typescript
// src/common/exceptions/prisma-exception.mapper.ts
import { Prisma } from '../../prisma/prisma-client.js'; // đổi từ '@prisma/client'
// ...phần còn lại giữ nguyên như setup trước
```

```typescript
// src/common/filters/handlers/prisma-error.handler.ts
import { Prisma } from '../../../prisma/prisma-client.js'; // đổi từ '@prisma/client'
// ...phần còn lại giữ nguyên như setup trước
```

---

## 6. Migration — local dev

```bash
npx prisma migrate dev --name init
```

Lệnh này tạo SQL migration trong `prisma/migrations/`, chạy migration đó vào DB, và tự chạy `prisma generate` để sinh lại client ở `src/generated/prisma`.

Thêm script tiện dùng vào `package.json`:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio"
  }
}
```

## 7. Chạy Postgres local bằng Docker (cho dev)

```yaml
# docker-compose.dev.yml — chỉ dùng ở máy local, không dùng cho production
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
docker compose -f docker-compose.dev.yml up -d
```

`DATABASE_URL` trong `.env` local trỏ vào `localhost:5432` như mục 2 đã setup.

---

## 8. Production trên VPS — thêm Postgres vào `docker-compose.yml` đã có

Nối tiếp setup Docker/CI đã làm trước đó, cập nhật `docker-compose.yml` trên VPS thêm service `postgres`:

```yaml
# /opt/myapp/docker-compose.yml (trên VPS)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    image: ghcr.io/your-username/myapp:latest
    env_file:
      - .env.production
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  pgdata:
```

`.env.production` trên VPS giờ cần cả 2 nhóm biến — biến khởi tạo container Postgres (`POSTGRES_*`) và biến app dùng để kết nối (`DATABASE_URL`, trỏ vào **tên service** `postgres` chứ không phải `localhost`, vì 2 container giao tiếp qua network nội bộ của compose):

```bash
# /opt/myapp/.env.production
NODE_ENV=production
PORT=3000

POSTGRES_USER=myapp_user
POSTGRES_PASSWORD=a_strong_password_here
POSTGRES_DB=myapp

DATABASE_URL=postgresql://myapp_user:a_strong_password_here@postgres:5432/myapp?schema=public

JWT_SECRET=...
```

## 9. Chạy migration khi deploy production

`prisma migrate dev` **không dùng cho production** (nó tương tác, có thể reset DB khi phát hiện drift). Production dùng `prisma migrate deploy` — chỉ áp các migration đã có sẵn trong `prisma/migrations/`, không tạo migration mới, an toàn để chạy tự động trong CI/CD.

Cập nhật step SSH trong workflow GitHub Actions đã có, thêm bước chạy migrate sau khi container mới lên:

```yaml
# .github/workflows/deploy.yml — nối tiếp job deploy đã có
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/myapp
            docker compose pull
            docker compose up -d
            docker compose exec -T app npx prisma migrate deploy
            docker image prune -f
```

## 10. Dockerfile — thêm bước `prisma generate` khi build

Prisma client phải được generate **trước khi** `nest build` chạy, vì code TypeScript import từ `src/generated/prisma` — nếu thiếu bước này, build sẽ lỗi "module not found".

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./dist/generated
COPY --from=build /app/prisma ./prisma
RUN npx prisma generate

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

> Chạy `prisma generate` cả ở stage production vì Prisma client sinh ra chứa native binary (query engine) phụ thuộc vào platform — build trên máy CI (thường Linux x64) rồi copy sang image Alpine base khác libc có thể lệch binary. Generate lại đúng trong image cuối cùng là cách an toàn nhất, tuy build lâu hơn chút.

---

## 11. Checklist bổ sung

- [ ] `DATABASE_URL` luôn trỏ đúng tên **service** trong compose (`postgres`), không phải `localhost`, khi chạy trong Docker network
- [ ] Local dev dùng `prisma migrate dev`, production luôn dùng `prisma migrate deploy` — không lẫn lộn 2 lệnh này
- [ ] Mọi import Prisma types (`Prisma`, `PrismaClient`) đi qua `src/prisma/prisma-client.ts`, không import thẳng `src/generated/prisma/...` ở nhiều nơi
- [ ] **Không** set `moduleFormat: "cjs"` trong generator — project ESM nên để mặc định
- [ ] Password trong `CreateUserDto` phải **hash** (vd `bcrypt`/`argon2`) trước khi lưu — ví dụ ở mục 4 mới chỉ minh hoạ luồng, chưa hash, cần bổ sung trước khi dùng thật
- [ ] `prisma/migrations/` **phải commit vào git** — đây là history schema, không phải file generated bỏ qua như `src/generated/prisma`
- [ ] Thêm `src/generated/` vào `.gitignore` (thư mục tự sinh, không commit)
