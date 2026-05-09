import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import {
  CreateFollowNotificationInput,
  CreateLikeNotificationInput,
  CreateMessageNotificationInput,
  CreateReplyNotificationInput,
  MarkAllNotificationsReadResponse,
  NotificationListResponse,
  NotificationResponse,
  NotificationResponseItem,
  UnreadNotificationsCountResponse,
} from './types/notification-response.type';
import { PrismaService } from '../prisma/prisma.service';

interface NotificationRecord {
  id: string;
  type: string;
  recipientId: string;
  actorId: string | null;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  targetType: string | null;
  targetId: string | null;
  message: string;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationInclude = {
  actor: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnreadCount(currentUserId: string): Promise<UnreadNotificationsCountResponse> {
    const unreadCount = await this.prisma.notification.count({
      where: {
        recipientId: currentUserId,
        readAt: null,
      },
    });

    return { unreadCount };
  }

  async listNotifications(
    currentUserId: string,
    query: NotificationsQueryDto,
  ): Promise<NotificationListResponse> {
    const limit = query.limit ?? 20;
    const notifications = (await this.prisma.notification.findMany({
      where: {
        recipientId: currentUserId,
        ...(query.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: notificationInclude,
    })) as NotificationRecord[];

    const hasNextPage = notifications.length > limit;
    const items = notifications
      .slice(0, limit)
      .map((notification) => this.toNotificationResponse(notification));

    return {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null,
        hasNextPage,
      },
    };
  }

  async markAsRead(currentUserId: string, notificationId: string): Promise<NotificationResponse> {
    const notification = (await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: currentUserId,
      },
      include: notificationInclude,
    })) as NotificationRecord | null;

    if (!notification) {
      throw this.notificationNotFoundException();
    }

    if (notification.readAt) {
      return {
        notification: this.toNotificationResponse(notification),
      };
    }

    const updatedNotification = (await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
      include: notificationInclude,
    })) as NotificationRecord;

    return {
      notification: this.toNotificationResponse(updatedNotification),
    };
  }

  async markAllAsRead(currentUserId: string): Promise<MarkAllNotificationsReadResponse> {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId: currentUserId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      updatedCount: result.count,
    };
  }

  async createLikeNotification(
    input: CreateLikeNotificationInput,
  ): Promise<NotificationResponseItem | null> {
    return this.createEventNotification({
      type: 'LIKE',
      actorId: input.actorId,
      recipientId: input.recipientId,
      targetType: input.targetType,
      targetId: input.targetId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      messageBuilder: (actorName) =>
        `${actorName} liked your ${input.targetType === 'POST' ? 'post' : 'reply'}.`,
      metadata: input.metadata,
    });
  }

  async createReplyNotification(
    input: CreateReplyNotificationInput,
  ): Promise<NotificationResponseItem | null> {
    return this.createEventNotification({
      type: 'REPLY',
      actorId: input.actorId,
      recipientId: input.recipientId,
      targetType: input.targetType,
      targetId: input.targetId,
      sourceType: 'REPLY',
      sourceId: input.replyId,
      messageBuilder: (actorName) =>
        `${actorName} replied to your ${input.targetType === 'POST' ? 'post' : 'reply'}.`,
      metadata: input.metadata,
    });
  }

  async createFollowNotification(
    input: CreateFollowNotificationInput,
  ): Promise<NotificationResponseItem | null> {
    return this.createEventNotification({
      type: 'FOLLOW',
      actorId: input.actorId,
      recipientId: input.recipientId,
      targetType: 'USER',
      targetId: input.actorId,
      sourceType: 'FOLLOW',
      sourceId: input.followId,
      messageBuilder: (actorName) => `${actorName} followed you.`,
      metadata: input.metadata,
    });
  }

  async createMessageNotification(
    input: CreateMessageNotificationInput,
  ): Promise<NotificationResponseItem | null> {
    return this.createEventNotification({
      type: 'MESSAGE',
      actorId: input.actorId,
      recipientId: input.recipientId,
      targetType: 'MESSAGE',
      targetId: input.messageId,
      sourceType: 'MESSAGE',
      sourceId: input.messageId,
      messageBuilder: (actorName) => `${actorName} sent you a message.`,
      metadata: {
        conversationId: input.conversationId,
        ...(this.isPlainObject(input.metadata) ? input.metadata : {}),
      },
    });
  }

  private async createEventNotification(input: {
    type: 'LIKE' | 'REPLY' | 'FOLLOW' | 'MESSAGE';
    actorId: string;
    recipientId: string;
    targetType: string;
    targetId: string;
    sourceType: string;
    sourceId: string;
    messageBuilder: (actorName: string) => string;
    metadata?: unknown;
  }): Promise<NotificationResponseItem | null> {
    if (input.actorId === input.recipientId) {
      return null;
    }

    const actorName = await this.getActorDisplayName(input.actorId);

    try {
      const notification = (await this.prisma.notification.create({
        data: {
          type: input.type,
          recipientId: input.recipientId,
          actorId: input.actorId,
          targetType: input.targetType,
          targetId: input.targetId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          message: input.messageBuilder(actorName),
          metadata: this.toPrismaJson(input.metadata),
        },
        include: notificationInclude,
      })) as unknown as NotificationRecord;

      return this.toNotificationResponse(notification);
    } catch (error) {
      if (this.isPrismaUniqueConstraintError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async getActorDisplayName(actorId: string): Promise<string> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: {
        displayName: true,
        username: true,
      },
    });

    return actor?.displayName ?? actor?.username ?? 'Someone';
  }

  private toNotificationResponse(notification: NotificationRecord): NotificationResponseItem {
    return {
      id: notification.id,
      type: notification.type,
      recipientId: notification.recipientId,
      actor: notification.actor,
      target: {
        type: notification.targetType,
        id: notification.targetId,
      },
      message: notification.message,
      metadata: notification.metadata,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  private notificationNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: 'NOTIFICATION_NOT_FOUND',
      message: 'Notification not found.',
    });
  }

  private isPrismaUniqueConstraintError(
    error: unknown,
  ): error is { code: 'P2002'; meta?: { target?: unknown } } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : (value as Prisma.InputJsonValue);
  }
}
