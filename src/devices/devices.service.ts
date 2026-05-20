import { Injectable } from '@nestjs/common';
import { RegisterDeviceTokenDto, RevokeDeviceTokenDto } from './dto/device-token.dto';
import { RegisterDeviceTokenManualDto } from './dto/register-device-token.dto';
import {
  DeviceTokenListResponse,
  DeviceTokenResponse,
  DeviceTokenResponseItem,
  RevokeDeviceTokenResponse,
} from './types/device-token-response.type';
import { PrismaService } from '../prisma/prisma.service';

interface DeviceTokenRecord {
  id: string;
  platform: string;
  deviceId: string | null;
  appVersion: string | null;
  lastUsedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSelect = {
  id: true,
  platform: true,
  deviceId: true,
  appVersion: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async registerFcmToken(
    userId: string,
    dto: RegisterDeviceTokenDto,
  ): Promise<DeviceTokenResponse> {
    const token = dto.token.trim();
    const now = new Date();
    const existingToken = await this.prisma.deviceToken.findUnique({
      where: { token },
      select: { id: true },
    });

    const data = {
      userId,
      token,
      platform: dto.platform.trim(),
      deviceId: this.optionalString(dto.deviceId),
      appVersion: this.optionalString(dto.appVersion),
      lastUsedAt: now,
      revokedAt: null,
    };

    const deviceToken = existingToken
      ? ((await this.prisma.deviceToken.update({
          where: { id: existingToken.id },
          data,
          select: deviceTokenSelect,
        })) as DeviceTokenRecord)
      : ((await this.prisma.deviceToken.create({
          data,
          select: deviceTokenSelect,
        })) as DeviceTokenRecord);

    return {
      deviceToken: this.toResponseItem(deviceToken),
    };
  }

  async registerTokenManual(dto: RegisterDeviceTokenManualDto): Promise<DeviceTokenResponse> {
    const token = dto.token.trim();
    const now = new Date();
    const existingToken = await this.prisma.deviceToken.findUnique({
      where: { token },
      select: { id: true },
    });

    const data = {
      userId: this.optionalString(dto.userId),
      token,
      platform: dto.platform.trim(),
      deviceId: null,
      appVersion: null,
      lastUsedAt: now,
      revokedAt: null,
    };

    const deviceToken = existingToken
      ? ((await this.prisma.deviceToken.update({
          where: { id: existingToken.id },
          data,
          select: deviceTokenSelect,
        })) as DeviceTokenRecord)
      : ((await this.prisma.deviceToken.create({
          data,
          select: deviceTokenSelect,
        })) as DeviceTokenRecord);

    return {
      deviceToken: this.toResponseItem(deviceToken),
    };
  }

  async revokeFcmToken(
    userId: string,
    dto: RevokeDeviceTokenDto,
  ): Promise<RevokeDeviceTokenResponse> {
    const result = await this.prisma.deviceToken.updateMany({
      where: {
        userId,
        token: dto.token.trim(),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      revoked: result.count > 0,
    };
  }

  async listFcmTokens(userId: string): Promise<DeviceTokenListResponse> {
    const deviceTokens = (await this.prisma.deviceToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { id: 'desc' }],
      select: deviceTokenSelect,
    })) as DeviceTokenRecord[];

    return {
      items: deviceTokens.map((deviceToken) => this.toResponseItem(deviceToken)),
    };
  }

  private toResponseItem(deviceToken: DeviceTokenRecord): DeviceTokenResponseItem {
    return {
      id: deviceToken.id,
      platform: deviceToken.platform,
      deviceId: deviceToken.deviceId,
      appVersion: deviceToken.appVersion,
      lastUsedAt: deviceToken.lastUsedAt,
      revokedAt: deviceToken.revokedAt,
      createdAt: deviceToken.createdAt,
      updatedAt: deviceToken.updatedAt,
    };
  }

  private optionalString(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
  }
}

