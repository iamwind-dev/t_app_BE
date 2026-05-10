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

export abstract class PushNotificationsService {
  abstract sendNotification(payload: PushNotificationPayload): Promise<void>;
}
