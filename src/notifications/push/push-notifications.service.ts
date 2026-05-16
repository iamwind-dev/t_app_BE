export interface PushNotificationPayload {
  id: string;
  type: string;
  recipientId: string;
  title: string;
  body: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, string>;
}

export interface DirectPushPayload {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface MulticastPushPayload {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface MulticastPushResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export abstract class PushNotificationsService {
  abstract sendNotification(payload: PushNotificationPayload): Promise<void>;
  abstract sendToToken(payload: DirectPushPayload): Promise<void>;
  abstract sendToTokens(payload: MulticastPushPayload): Promise<MulticastPushResult>;
}
