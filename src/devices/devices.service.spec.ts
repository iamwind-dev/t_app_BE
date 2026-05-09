import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';

type MockPrismaService = {
  deviceToken: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('DevicesService', () => {
  let service: DevicesService;
  let prisma: MockPrismaService;

  const userId = '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
  const otherUserId = '02d50f39-eef6-4edb-85c0-2dd8d020df3a';
  const createdAt = new Date('2026-04-24T14:00:00.000Z');
  const updatedAt = new Date('2026-04-24T14:01:00.000Z');
  const lastUsedAt = new Date('2026-04-24T14:02:00.000Z');
  const deviceToken = {
    id: '6e78f9f5-1bb5-497f-96ec-4465c7fcd74a',
    userId,
    token: 'raw-fcm-token',
    platform: 'android',
    deviceId: 'pixel-8',
    appVersion: '1.0.0',
    lastUsedAt,
    revokedAt: null,
    createdAt,
    updatedAt,
  };

  beforeEach(() => {
    prisma = {
      deviceToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new DevicesService(prisma as unknown as PrismaService);
  });

  it('registers a new FCM token without returning the raw token', async () => {
    prisma.deviceToken.findUnique.mockResolvedValue(null);
    prisma.deviceToken.create.mockResolvedValue(deviceToken);
    jest.spyOn(global, 'Date').mockImplementation(() => lastUsedAt);

    const result = await service.registerFcmToken(userId, {
      token: ' raw-fcm-token ',
      platform: 'android',
      deviceId: ' pixel-8 ',
      appVersion: ' 1.0.0 ',
    });

    expect(prisma.deviceToken.create).toHaveBeenCalledWith({
      data: {
        userId,
        token: 'raw-fcm-token',
        platform: 'android',
        deviceId: 'pixel-8',
        appVersion: '1.0.0',
        lastUsedAt,
        revokedAt: null,
      },
      select: expect.any(Object),
    });
    expect(result.deviceToken).toEqual({
      id: deviceToken.id,
      platform: 'android',
      deviceId: 'pixel-8',
      appVersion: '1.0.0',
      lastUsedAt,
      revokedAt: null,
      createdAt,
      updatedAt,
    });
    expect(result.deviceToken).not.toHaveProperty('token');

    jest.restoreAllMocks();
  });

  it('updates and transfers an existing token to the authenticated user', async () => {
    prisma.deviceToken.findUnique.mockResolvedValue({ id: deviceToken.id, userId: otherUserId });
    prisma.deviceToken.update.mockResolvedValue({ ...deviceToken, userId });
    jest.spyOn(global, 'Date').mockImplementation(() => lastUsedAt);

    await service.registerFcmToken(userId, {
      token: 'raw-fcm-token',
      platform: 'ios',
      deviceId: undefined,
      appVersion: undefined,
    });

    expect(prisma.deviceToken.update).toHaveBeenCalledWith({
      where: { id: deviceToken.id },
      data: {
        userId,
        token: 'raw-fcm-token',
        platform: 'ios',
        deviceId: null,
        appVersion: null,
        lastUsedAt,
        revokedAt: null,
      },
      select: expect.any(Object),
    });

    jest.restoreAllMocks();
  });

  it('revokes only the current user token idempotently', async () => {
    prisma.deviceToken.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(global, 'Date').mockImplementation(() => lastUsedAt);

    const result = await service.revokeFcmToken(userId, { token: ' raw-fcm-token ' });

    expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        token: 'raw-fcm-token',
        revokedAt: null,
      },
      data: {
        revokedAt: lastUsedAt,
      },
    });
    expect(result).toEqual({ revoked: true });

    jest.restoreAllMocks();
  });

  it('returns revoked false when the token is missing or owned by another user', async () => {
    prisma.deviceToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.revokeFcmToken(userId, { token: 'raw-fcm-token' });

    expect(result).toEqual({ revoked: false });
  });

  it('lists only active current-user tokens without raw token values', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([deviceToken]);

    const result = await service.listFcmTokens(userId);

    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { id: 'desc' }],
      select: expect.any(Object),
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('token');
  });
});

