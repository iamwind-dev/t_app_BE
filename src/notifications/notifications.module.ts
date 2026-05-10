import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebasePushNotificationsService } from './push/firebase-push-notifications.service';
import { PushNotificationsService } from './push/push-notifications.service';

@Module({
  imports: [ConfigModule, PrismaModule],
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
