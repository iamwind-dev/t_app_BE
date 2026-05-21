import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationsService } from './push/push-notifications.service';

type MockPrismaService = {
  notification: {
    count: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: MockPrismaService;
  let pushNotificationsService: {
    sendNotification: jest.Mock;
    sendToToken: jest.Mock;
    sendToTokens: jest.Mock;
  };

  const recipientId = '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
  const actorId = '02d50f39-eef6-4edb-85c0-2dd8d020df3a';
  const notificationId = '6e78f9f5-1bb5-497f-96ec-4465c7fcd74a';
  const postId = '83052a85-52f0-47f8-b94e-f1ca1c7f6903';
  const sourceId = '53052a85-52f0-47f8-b94e-f1ca1c7f6903';
  const createdAt = new Date('2026-04-24T14:00:00.000Z');
  const readAt = new Date('2026-04-24T15:00:00.000Z');
  const actor = {
    id: actorId,
    username: 'other_user',
    displayName: 'Other User',
    avatarUrl: 'https://cdn.example.com/avatars/other-user.png',
  };
  const notification = {
    id: notificationId,
    type: 'LIKE',
    recipientId,
    actor,
    actorId,
    targetType: 'POST',
    targetId: postId,
    sourceType: 'POST_REACTION',
    sourceId,
    message: 'Other User liked your post.',
    metadata: { postPreview: 'Hello from Threads-like app.' },
    readAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  beforeEach(() => {
    prisma = {
      notification: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    pushNotificationsService = {
      sendNotification: jest.fn(),
      sendToToken: jest.fn(),
      sendToTokens: jest.fn(),
    };

    service = new NotificationsService(
      prisma as unknown as PrismaService,
      pushNotificationsService as unknown as PushNotificationsService,
    );
  });

  it('returns unread notification count for the current user', async () => {
    prisma.notification.count.mockResolvedValue(12);

    const result = await service.getUnreadCount(recipientId);

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        recipientId,
        readAt: null,
      },
    });
    expect(result).toEqual({ unreadCount: 12 });
  });

  it('lists only current user notifications with pagination and actor summary', async () => {
    prisma.notification.findMany.mockResolvedValue([notification]);

    const result = await service.listNotifications(recipientId, { limit: 20 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        recipientId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      cursor: undefined,
      skip: undefined,
      include: expect.any(Object),
    });
    expect(result.items).toEqual([
      {
        id: notificationId,
        type: 'LIKE',
        recipientId,
        actor,
        target: {
          type: 'POST',
          id: postId,
        },
        message: 'Other User liked your post.',
        metadata: { postPreview: 'Hello from Threads-like app.' },
        readAt: null,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    expect(result.pageInfo).toEqual({
      nextCursor: null,
      hasNextPage: false,
    });
  });

  it('filters unread notifications when unreadOnly is true', async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    await service.listNotifications(recipientId, { limit: 20, unreadOnly: true });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recipientId,
          readAt: null,
        },
      }),
    );
  });

  it('marks one current-user notification as read idempotently', async () => {
    prisma.notification.findFirst.mockResolvedValue(notification);
    prisma.notification.update.mockResolvedValue({ ...notification, readAt });
    jest.spyOn(global, 'Date').mockImplementation(() => readAt);

    const result = await service.markAsRead(recipientId, notificationId);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        recipientId,
      },
      include: expect.any(Object),
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: notificationId },
      data: { readAt },
      include: expect.any(Object),
    });
    expect(result.notification.readAt).toBe(readAt);

    jest.restoreAllMocks();
  });

  it('keeps the original readAt for an already-read notification', async () => {
    prisma.notification.findFirst.mockResolvedValue({ ...notification, readAt });

    const result = await service.markAsRead(recipientId, notificationId);

    expect(prisma.notification.update).not.toHaveBeenCalled();
    expect(result.notification.readAt).toBe(readAt);
  });

  it('does not reveal notifications owned by another user', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markAsRead(recipientId, notificationId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('marks all unread notifications for the current user as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    jest.spyOn(global, 'Date').mockImplementation(() => readAt);

    const result = await service.markAllAsRead(recipientId);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        recipientId,
        readAt: null,
      },
      data: {
        readAt,
      },
    });
    expect(result).toEqual({ updatedCount: 3 });

    jest.restoreAllMocks();
  });

  it('creates a like notification for another user and skips self-like notifications', async () => {
    prisma.user.findUnique.mockResolvedValue(actor);
    prisma.notification.create.mockResolvedValue(notification);

    const created = await service.createLikeNotification({
      actorId,
      recipientId,
      targetType: 'POST',
      targetId: postId,
      sourceType: 'POST_REACTION',
      sourceId,
    });
    const skipped = await service.createLikeNotification({
      actorId: recipientId,
      recipientId,
      targetType: 'POST',
      targetId: postId,
      sourceType: 'POST_REACTION',
      sourceId,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        type: 'LIKE',
        recipientId,
        actorId,
        targetType: 'POST',
        targetId: postId,
        sourceType: 'POST_REACTION',
        sourceId,
        message: 'Other User liked your post.',
        metadata: undefined,
      },
      include: expect.any(Object),
    });
    expect(created?.id).toBe(notificationId);
    expect(skipped).toBeNull();
    expect(pushNotificationsService.sendNotification).toHaveBeenCalledTimes(1);
    expect(pushNotificationsService.sendNotification).toHaveBeenCalledWith({
      id: notificationId,
      type: 'LIKE',
      recipientId,
      title: 'Together Notification',
      body: 'Other User liked your post.',
      targetType: 'POST',
      targetId: postId,
      metadata: {
        postPreview: 'Hello from Threads-like app.',
      },
    });
  });

  it('creates a message notification after message persistence', async () => {
    prisma.user.findUnique.mockResolvedValue(actor);
    prisma.notification.create.mockResolvedValue({
      ...notification,
      type: 'MESSAGE',
      targetType: 'MESSAGE',
      targetId: sourceId,
      sourceType: 'MESSAGE',
      message: 'Other User sent you a message.',
    });

    const result = await service.createMessageNotification({
      actorId,
      recipientId,
      conversationId: postId,
      messageId: sourceId,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        type: 'MESSAGE',
        recipientId,
        actorId,
        targetType: 'MESSAGE',
        targetId: sourceId,
        sourceType: 'MESSAGE',
        sourceId,
        message: 'Other User sent you a message.',
        metadata: {
          conversationId: postId,
        },
      },
      include: expect.any(Object),
    });
    expect(result?.type).toBe('MESSAGE');
  });

  it('does not fail notification creation when push delivery fails', async () => {
    prisma.user.findUnique.mockResolvedValue(actor);
    prisma.notification.create.mockResolvedValue(notification);
    pushNotificationsService.sendNotification.mockRejectedValue(new Error('fcm failed'));

    const result = await service.createLikeNotification({
      actorId,
      recipientId,
      targetType: 'POST',
      targetId: postId,
      sourceType: 'POST_REACTION',
      sourceId,
    });

    expect(result?.id).toBe(notificationId);
  });
});
