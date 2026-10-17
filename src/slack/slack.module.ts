import { Module } from '@nestjs/common';
import { SlackController } from './slack.controller.js';
import { SlackChannelsController } from './slack-channels.controller.js';
import { SlackService } from './slack.service.js';
import { SlackChannelsService } from './slack-channels.service.js';
import { SlackCryptoService } from './slack-crypto.service.js';
import { SlackApiClient } from './slack-api.client.js';

// PrismaModule và ConfigModule đều @Global()/isGlobal nên không cần import. Export crypto + api client
// để bước 4.5 (/ask) dùng lại: giải mã token, gọi chat.postMessage.
@Module({
  controllers: [SlackController, SlackChannelsController],
  providers: [
    SlackService,
    SlackChannelsService,
    SlackCryptoService,
    SlackApiClient,
  ],
  exports: [
    SlackService,
    SlackChannelsService,
    SlackCryptoService,
    SlackApiClient,
  ],
})
export class SlackModule {}
