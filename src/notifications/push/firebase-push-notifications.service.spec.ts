import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebasePushNotificationsService } from './firebase-push-notifications.service';

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn((serviceAccount: unknown) => ({ serviceAccount })),
  getApps: jest.fn(),
  initializeApp: jest.fn(() => ({ name: 'threads-like-backend' })),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(),
}));

describe('FirebasePushNotificationsService', () => {
  let prisma: {
    deviceToken: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let messaging: {
    sendEachForMulticast: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      deviceToken: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    messaging = {
      sendEachForMulticast: jest.fn(),
    };

    jest.mocked(getApps).mockReturnValue([]);
    jest.mocked(getMessaging).mockReturnValue(messaging as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends Firebase multicast notifications to active user tokens', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'fcm-token-a' }, { token: 'fcm-token-b' }]);
    messaging.sendEachForMulticast.mockResolvedValue({
      responses: [{ success: true }, { success: true }],
    });

    const service = new FirebasePushNotificationsService(
      {
        get: jest.fn((key: string) => {
          const values: Record<string, string> = {
            FIREBASE_PROJECT_ID: 'project-id',
            FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
            FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----\\n',
          };

          return values[key];
        }),
      } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    await service.sendNotification({
      id: 'notification-id',
      type: 'MESSAGE',
      recipientId: 'recipient-id',
      title: 'New notification',
      body: 'Alice sent you a message.',
      targetType: 'MESSAGE',
      targetId: 'message-id',
      metadata: { conversationId: 'conversation-id' },
    });

    expect(cert).toHaveBeenCalledWith({
      projectId: 'project-id',
      clientEmail: 'firebase@example.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----\n',
    });
    expect(initializeApp).toHaveBeenCalled();
    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'recipient-id',
        revokedAt: null,
      },
      select: {
        token: true,
      },
    });
    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['fcm-token-a', 'fcm-token-b'],
      notification: {
        title: 'New notification',
        body: 'Alice sent you a message.',
      },
      data: {
        notificationId: 'notification-id',
        notificationType: 'MESSAGE',
        targetType: 'MESSAGE',
        targetId: 'message-id',
        conversationId: 'conversation-id',
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
  });

  it('revokes Firebase tokens rejected as invalid', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'valid-token' }, { token: 'bad-token' }]);
    messaging.sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    });

    const service = new FirebasePushNotificationsService(
      {
        get: jest.fn((key: string) =>
          key === 'FIREBASE_SERVICE_ACCOUNT_JSON'
            ? JSON.stringify({
                projectId: 'project-id',
                clientEmail: 'firebase@example.com',
                privateKey: 'private-key',
              })
            : undefined,
        ),
      } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    await service.sendNotification({
      id: 'notification-id',
      type: 'FOLLOW',
      recipientId: 'recipient-id',
      title: 'New notification',
      body: 'Alice followed you.',
      targetType: 'USER',
      targetId: 'actor-id',
      metadata: {},
    });

    expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
      where: {
        token: {
          in: ['bad-token'],
        },
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('throws a clear error when Firebase credentials are not configured', async () => {
    const service = new FirebasePushNotificationsService(
      { get: jest.fn() } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    await expect(
      service.sendNotification({
        id: 'notification-id',
        type: 'FOLLOW',
        recipientId: 'recipient-id',
        title: 'New notification',
        body: 'Alice followed you.',
        targetType: 'USER',
        targetId: 'actor-id',
        metadata: {},
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
