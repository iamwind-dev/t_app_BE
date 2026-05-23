export interface NotificationActorSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface NotificationTargetSummary {
  type: string | null;
  id: string | null;
}

export interface NotificationResponseItem {
  id: string;
  type: string;
  recipientId: string;
  actor: NotificationActorSummary | null;
  target: NotificationTargetSummary;
  message: string;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationListResponse {
  items: NotificationResponseItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface NotificationResponse {
  notification: NotificationResponseItem;
}

export interface MarkAllNotificationsReadResponse {
  updatedCount: number;
}

export interface UnreadNotificationsCountResponse {
  unreadCount: number;
}

export type NotificationTargetType = 'POST' | 'REPLY' | 'REEL' | 'USER' | 'MESSAGE' | 'CONVERSATION';

export interface CreateLikeNotificationInput {
  actorId: string;
  recipientId: string;
  targetType: Extract<NotificationTargetType, 'POST' | 'REPLY' | 'REEL'>;
  targetId: string;
  sourceType: 'POST_REACTION' | 'REPLY_REACTION' | 'REEL_REACTION';
  sourceId: string;
  metadata?: unknown;
}

export interface CreateReplyNotificationInput {
  actorId: string;
  recipientId: string;
  targetType: Extract<NotificationTargetType, 'POST' | 'REPLY' | 'REEL'>;
  targetId: string;
  replyId: string;
  metadata?: unknown;
}

export interface CreateFollowNotificationInput {
  actorId: string;
  recipientId: string;
  followId: string;
  metadata?: unknown;
}

export interface CreateMessageNotificationInput {
  actorId: string;
  recipientId: string;
  conversationId: string;
  messageId: string;
  metadata?: unknown;
}
