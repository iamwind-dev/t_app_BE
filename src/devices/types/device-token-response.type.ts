export interface DeviceTokenResponseItem {
  id: string;
  platform: string;
  deviceId: string | null;
  appVersion: string | null;
  lastUsedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceTokenResponse {
  deviceToken: DeviceTokenResponseItem;
}

export interface DeviceTokenListResponse {
  items: DeviceTokenResponseItem[];
}

export interface RevokeDeviceTokenResponse {
  revoked: boolean;
}

