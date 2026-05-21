import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DomainEventsModule } from '../domain-events/domain-events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebasePushNotificationsService } from './push/firebase-push-notifications.service';
import { PushNotificationsService } from './push/push-notifications.service';

@Module({
  imports: [ConfigModule, PrismaModule, DomainEventsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: PushNotificationsService,
      useClass: FirebasePushNotificationsService,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
