import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { RealtimeEventsService } from '../domain-events/realtime-events.service';
import { DomainEventEnvelope } from '../domain-events/types/domain-event.type';
import { TestPushTokenDto } from './dto/test-push-token.dto';
import { TestPushUserDto } from './dto/test-push-user.dto';
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
import { PushNotificationsService } from './push/push-notifications.service';
import {
  PushNotificationPayloadType,
  PushToUserResult,
} from './types/push-notification-payload.type';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly domainEventsService?: DomainEventsService,
    private readonly realtimeEventsService?: RealtimeEventsService,
  ) {}

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
        `${actorName} liked your ${this.toContentLabel(input.targetType)}.`,
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
      messageBuilder: (actorName) => {
        if (input.targetType === 'REEL') {
          return `${actorName} commented on your reel.`;
        }

        return `${actorName} replied to your ${this.toContentLabel(input.targetType)}.`;
      },
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

  async sendTestPushToToken(dto: TestPushTokenDto): Promise<{ sent: true }> {
    const payload = this.toPushPayload(dto.title, dto.body, dto.data);

    try {
      await this.pushNotificationsService.sendToToken({
        token: dto.token.trim(),
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });
      return { sent: true };
    } catch (error) {
      throw this.mapPushError(error);
    }
  }

  async sendTestPushToUser(userId: string, dto: TestPushUserDto): Promise<PushToUserResult> {
    const payload = this.toPushPayload(dto.title, dto.body, dto.data);
    const tokens = await this.prisma.deviceToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        token: true,
      },
    });
    const tokenValues = tokens.map((item) => item.token);

    if (tokenValues.length === 0) {
      return {
        requestedCount: 0,
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      };
    }

    const result = await this.pushNotificationsService.sendToTokens({
      tokens: tokenValues,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });

    if (result.invalidTokens.length > 0) {
      await this.prisma.deviceToken.deleteMany({
        where: {
          token: {
            in: result.invalidTokens,
          },
        },
      });
    }

    await this.prisma.notification.create({
      data: {
        type: 'SYSTEM',
        recipientId: userId,
        message: payload.body,
        targetType: 'USER',
        targetId: userId,
        sourceType: 'PUSH_TEST',
        sourceId: `PUSH_TEST:${Date.now()}`,
        metadata: this.toPrismaJson(payload.data),
      },
    });

    return {
      requestedCount: tokenValues.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      invalidTokens: result.invalidTokens,
    };
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
      const result = await this.runInTransaction(async (tx) => {
        const client = tx;
        const notification = (await client.notification.create({
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
        })) as NotificationRecord;
        const response = this.toNotificationResponse(notification);
        const event = await this.createOutboxEvent(
          {
            type: 'notification.created',
            actorId: input.actorId,
            subjectType: 'NOTIFICATION',
            subjectId: response.id,
            rooms: [`user:${input.recipientId}`],
            payload: {
              notification: response,
            },
          },
          client,
        );

        return { notification, event };
      });

      const response = this.toNotificationResponse(result.notification);
      await this.dispatchPushNotification(response);
      await this.publishEvent(result.event);

      return response;
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

  private toContentLabel(targetType: string): string {
    if (targetType === 'REEL') {
      return 'reel';
    }

    if (targetType === 'REPLY') {
      return 'reply';
    }

    return 'post';
  }

  private async dispatchPushNotification(notification: NotificationResponseItem): Promise<void> {
    try {
      await this.pushNotificationsService.sendNotification({
        id: notification.id,
        type: notification.type,
        recipientId: notification.recipientId,
        title: 'Together Notification',
        body: notification.message,
        targetType: notification.target.type,
        targetId: notification.target.id,
        metadata: this.toPushMetadata(notification.metadata),
      });
    } catch {
      return;
    }
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

  private toPushMetadata(value: unknown): Record<string, string> {
    if (!this.isPlainObject(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter((entry): entry is [string, string | number | boolean] =>
          ['string', 'number', 'boolean'].includes(typeof entry[1]),
        )
        .map(([key, metadataValue]) => [key, String(metadataValue)]),
    );
  }

  private toPushPayload(
    title: string,
    body: string,
    data: Record<string, string | number | boolean> | undefined,
  ): PushNotificationPayloadType {
    return {
      title: title.trim(),
      body: body.trim(),
      data: this.toPushMetadata(data),
    };
  }

  private mapPushError(error: unknown): BadRequestException | InternalServerErrorException {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : '';

    if (
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-argument'
    ) {
      return new BadRequestException({
        code: 'FCM_TOKEN_INVALID',
        message: 'FCM token is invalid or not registered.',
      });
    }

    if (code === 'messaging/mismatched-credential') {
      return new BadRequestException({
        code: 'FCM_SENDER_ID_MISMATCH',
        message: 'Sender ID mismatch between token and Firebase project.',
      });
    }

    if (code === 'messaging/authentication-error') {
      return new BadRequestException({
        code: 'FCM_PERMISSION_DENIED',
        message: 'Firebase credentials are invalid or missing permission.',
      });
    }

    const message =
      error instanceof Error && error.message.length > 0 ? error.message : 'Unknown Firebase error.';

    return new InternalServerErrorException({
      code: 'FCM_SEND_FAILED',
      message: `Failed to send push notification. Firebase code: ${code || 'unknown'}. ${message}`,
    });
  }

  private async createOutboxEvent(
    input: {
    type: string;
    actorId: string;
    subjectType: string;
    subjectId: string;
    rooms: string[];
    payload: unknown;
    },
    tx: NotificationsTransactionClient,
  ): Promise<DomainEventEnvelope | null> {
    if (!this.domainEventsService) {
      return null;
    }

    return this.domainEventsService.createEvent(input, tx);
  }

  private async publishEvent(event: DomainEventEnvelope | null): Promise<void> {
    if (!event || !this.domainEventsService || !this.realtimeEventsService) {
      return;
    }

    try {
      this.realtimeEventsService.publish(event);
      await this.domainEventsService.markPublished(event.eventId);
    } catch {
      return;
    }
  }

  private async runInTransaction<T>(
    fn: (tx: NotificationsTransactionClient) => Promise<T>,
  ): Promise<T> {
    if (typeof this.prisma.$transaction !== 'function') {
      return fn(this.prisma);
    }

    return this.prisma.$transaction(async (tx) => fn(tx));
  }
}

interface NotificationsTransactionClient {
  notification: {
    create(args: unknown): Promise<unknown>;
  };
  domainEventOutbox: {
    create(args: unknown): Promise<unknown>;
  };
}
