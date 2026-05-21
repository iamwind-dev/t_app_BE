import { Module } from '@nestjs/common';

import { DomainEventsModule } from '../domain-events/domain-events.module';

import { ModerationModule } from '../modules/moderation/moderation.module';

import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { RepliesController } from './replies.controller';
import { RepliesService } from './replies.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    UploadsModule,
    DomainEventsModule,
    ModerationModule,
  ],
  controllers: [RepliesController],
  providers: [RepliesService],
  exports: [RepliesService],
})
export class RepliesModule {}
