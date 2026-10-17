import { Module } from '@nestjs/common';
import { PublicApiModule } from '../public-api/public-api.module.js';
import { SlackController } from './slack.controller.js';
import { SlackChannelsController } from './slack-channels.controller.js';
import { SlackCommandsController } from './slack-commands.controller.js';
import { SlackService } from './slack.service.js';
import { SlackChannelsService } from './slack-channels.service.js';
import { SlackCommandsService } from './slack-commands.service.js';
import { SlackSignatureGuard } from './slack-signature.guard.js';
import { SlackCryptoService } from './slack-crypto.service.js';
import { SlackApiClient } from './slack-api.client.js';

// PrismaModule và ConfigModule đều @Global()/isGlobal nên không cần import.
// PublicApiModule: export PublicQueryService — /ask dùng lại đúng luồng RAG của /v1/query.
@Module({
  imports: [PublicApiModule],
  controllers: [
    SlackController,
    SlackChannelsController,
    SlackCommandsController,
  ],
  providers: [
    SlackService,
    SlackChannelsService,
    SlackCommandsService,
    SlackSignatureGuard,
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
