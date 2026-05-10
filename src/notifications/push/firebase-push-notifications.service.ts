import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import type { BatchResponse, Messaging } from 'firebase-admin/messaging';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PushNotificationPayload,
  PushNotificationsService,
} from './push-notifications.service';

const invalidTokenErrorCodes = new Set([
  'messaging/invalid-argument',
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

@Injectable()
export class FirebasePushNotificationsService implements PushNotificationsService {
  private readonly firebaseMessaging: Messaging | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.firebaseMessaging = this.createMessagingClient();
  }

  async sendNotification(payload: PushNotificationPayload): Promise<void> {
    if (!this.firebaseMessaging) {
      return;
    }

    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: {
        userId: payload.recipientId,
        revokedAt: null,
      },
      select: {
        token: true,
      },
    });
    const tokens = deviceTokens.map((deviceToken) => deviceToken.token);

    if (tokens.length === 0) {
      return;
    }

    const response = await this.firebaseMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        notificationId: payload.id,
        notificationType: payload.type,
        targetType: payload.targetType ?? '',
        targetId: payload.targetId ?? '',
        ...payload.metadata,
      },
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    await this.revokeInvalidTokens(tokens, response);
  }

  private createMessagingClient(): Messaging | null {
    const serviceAccount = this.getServiceAccount();
    if (!serviceAccount) {
      return null;
    }

    const appName = 'threads-like-backend';
    const app =
      getApps().find((firebaseApp) => firebaseApp.name === appName) ??
      initializeApp(
        {
          credential: cert(serviceAccount),
        },
        appName,
      );

    return getMessaging(app);
  }

  private getServiceAccount(): ServiceAccount | null {
    const rawServiceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (rawServiceAccount) {
      return JSON.parse(rawServiceAccount) as ServiceAccount;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  private async revokeInvalidTokens(tokens: string[], response: BatchResponse): Promise<void> {
    const invalidTokens = response.responses
      .map((item, index) => {
        const code = item.error?.code;
        return code && invalidTokenErrorCodes.has(code) ? tokens[index] : null;
      })
      .filter((token): token is string => Boolean(token));

    if (invalidTokens.length === 0) {
      return;
    }

    await this.prisma.deviceToken.updateMany({
      where: {
        token: {
          in: invalidTokens,
        },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
