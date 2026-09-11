# Database & RLS Architecture Guidelines

This document defines the critical rules for interacting with the database, Multi-tenant Row Level Security (RLS), and Prisma within the DocMind project. All AI agents MUST adhere to these rules when generating or modifying backend code.

## 1. No Global Database Interceptors
**NEVER** use Interceptors (e.g., `TenantContextInterceptor`) to automatically open Prisma transactions for an entire HTTP request.
- **Why**: DocMind is an AI application. API requests often involve long-running operations (like calling OpenAI/LLMs, which take 5-10 seconds). Keeping a database transaction open for the entire request lifecycle will quickly exhaust the PostgreSQL connection pool (Connection Pool Exhaustion) and crash the app.

## 2. Using `runInTenantContext` (For Business Logic)
For any business logic that queries or modifies tenant-specific data (tables with RLS enabled, like `documents`, `collections`, `messages`), you MUST wrap ONLY the database query logic inside `runInTenantContext`.
- **Where to call**: Inside the Service layer.
- **Rule**: Retrieve data, close the transaction, run external/slow APIs, then open a new transaction to save the results.
- **Example**:
  ```typescript
  // 1. Lấy context từ DB (nhanh)
  const docs = await this.prisma.runInTenantContext(tenantId, async (tx) => {
    return tx.documentChunk.findMany(...);
  });
  
  // 2. Gọi AI / Xử lý nặng (chậm) - Tuyệt đối không nằm trong transaction
  const answer = await this.llm.generate(question, docs);
  
  // 3. Lưu lại vào DB (nhanh)
  await this.prisma.runInTenantContext(tenantId, async (tx) => {
    return tx.message.create(...);
  });
  ```

## 3. Using `runAsSystem` (For Auth/Admin Logic)
For Authentication or Global APIs that need to read cross-tenant data (e.g., getting a list of workspaces for a user upon login), RLS will block the query. 
- **Rule**: Use `this.prisma.runAsSystem(...)` to temporarily disable RLS (`SET LOCAL row_security = off;`) and query the data safely.
- **Warning**: Never use this for standard business logic, as it completely bypasses tenant isolation.

## 4. Prisma 7 and PostgreSQL Connection
- The project uses **Prisma 7**.
- Prisma 7 requires driver adapters for SQL databases.
- The `PrismaService` manually instantiates a `pg.Pool` and passes it to `@prisma/adapter-pg`.
- The `pg.Pool` lifecycle is manually managed and closed inside `onModuleDestroy()` to prevent memory leaks. Never remove this logic.
