import { Module } from '@nestjs/common';
import { SlackController } from './slack.controller.js';
import { SlackService } from './slack.service.js';
import { SlackCryptoService } from './slack-crypto.service.js';
import { SlackApiClient } from './slack-api.client.js';

// PrismaModule và ConfigModule đều @Global()/isGlobal nên không cần import. Export crypto + api client
// để bước 4.5 (/ask) dùng lại: giải mã token, gọi chat.postMessage.
@Module({
  controllers: [SlackController],
  providers: [SlackService, SlackCryptoService, SlackApiClient],
  exports: [SlackService, SlackCryptoService, SlackApiClient],
})
export class SlackModule {}
