export interface PushNotificationPayloadType {
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushToUserResult {
  requestedCount: number;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}
