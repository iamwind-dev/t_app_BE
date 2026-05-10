import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

type MockUser = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  status: string;
};

type MockPrismaService = {
  $transaction: jest.Mock;
  user: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  authRefreshToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let jwtService: Pick<JwtService, 'signAsync'>;

  const activeUser: MockUser = {
    id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
    email: 'user@example.com',
    username: 'user_name',
    passwordHash: 'hashed-password',
    displayName: 'User Name',
    avatarUrl: null,
    createdAt: new Date('2026-04-24T14:00:00.000Z'),
    updatedAt: new Date('2026-04-24T14:00:00.000Z'),
    deletedAt: null,
    status: 'active',
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (input: unknown) => {
        if (typeof input === 'function') {
          return input(prisma);
        }

        if (Array.isArray(input)) {
          return Promise.all(input);
        }

        return input;
      }),
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      authRefreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'refresh-token-id' }),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('jwt.access.token'),
    };

    service = new AuthService(prisma as unknown as PrismaService, jwtService as JwtService);
    jest.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers a user with normalized email, hashed password, and no passwordHash in response', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(activeUser);

    const result = await service.register({
      email: '  USER@Example.COM  ',
      username: ' user_name ',
      password: 'StrongPassword123!',
      displayName: ' User Name ',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'user@example.com' }, { username: 'user_name' }],
      },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith('StrongPassword123!', 12);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'user@example.com',
        username: 'user_name',
        passwordHash: 'hashed-password',
        displayName: 'User Name',
      },
    });
    expect(result).toEqual({
      user: {
        id: activeUser.id,
        email: activeUser.email,
        username: activeUser.username,
        displayName: activeUser.displayName,
        avatarUrl: null,
        createdAt: activeUser.createdAt,
        updatedAt: activeUser.updatedAt,
      },
      accessToken: 'jwt.access.token',
      refreshToken: expect.any(String),
    });
    expect(prisma.authRefreshToken.create).toHaveBeenCalledWith({
      data: {
        userId: activeUser.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      },
    });
  });

  it('rejects duplicate email during registration', async () => {
    prisma.user.findFirst.mockResolvedValue({ ...activeUser, username: 'other_user' });

    await expect(
      service.register({
        email: 'user@example.com',
        username: 'new_user',
        password: 'StrongPassword123!',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('logs in with email and returns a token with public user fields', async () => {
    prisma.user.findFirst.mockResolvedValue(activeUser);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await service.login({
      identifier: 'USER@example.com',
      password: 'StrongPassword123!',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'user@example.com' }, { username: 'USER@example.com' }],
      },
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('StrongPassword123!', 'hashed-password');
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: activeUser.id });
    expect(result.accessToken).toBe('jwt.access.token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('refreshes access tokens and rotates refresh tokens', async () => {
    const refreshToken = 'a'.repeat(48);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'old-refresh-token-id',
      userId: activeUser.id,
      tokenHash: 'old-hash',
      expiresAt,
      revokedAt: null,
      user: activeUser,
    });
    prisma.authRefreshToken.create.mockResolvedValue({ id: 'new-refresh-token-id' });

    const result = await service.refresh({ refreshToken });

    expect(prisma.authRefreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
      include: { user: true },
    });
    expect(prisma.authRefreshToken.update).toHaveBeenCalledWith({
      where: { id: 'old-refresh-token-id' },
      data: {
        revokedAt: expect.any(Date),
        replacedByTokenId: 'new-refresh-token-id',
      },
    });
    expect(result).toEqual({
      accessToken: 'jwt.access.token',
      refreshToken: expect.any(String),
    });
  });

  it('rejects invalid, revoked, or expired refresh tokens', async () => {
    prisma.authRefreshToken.findUnique.mockResolvedValue(null);

    await expect(service.refresh({ refreshToken: 'a'.repeat(48) })).rejects.toThrow(
      UnauthorizedException,
    );

    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'old-refresh-token-id',
      userId: activeUser.id,
      tokenHash: 'old-hash',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      revokedAt: null,
      user: activeUser,
    });

    await expect(service.refresh({ refreshToken: 'b'.repeat(48) })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('logs out by revoking the supplied refresh token', async () => {
    prisma.authRefreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.logout({ refreshToken: 'a'.repeat(48) });

    expect(prisma.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({ loggedOut: true });
  });

  it('changes password and revokes active refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.user.update.mockResolvedValue(activeUser);
    prisma.authRefreshToken.updateMany.mockResolvedValue({ count: 2 });
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    jest.mocked(bcrypt.hash).mockResolvedValue('new-hashed-password' as never);

    const result = await service.changePassword(activeUser.id, {
      currentPassword: 'StrongPassword123!',
      newPassword: 'NewStrongPassword123!',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith('StrongPassword123!', 'hashed-password');
    expect(bcrypt.hash).toHaveBeenCalledWith('NewStrongPassword123!', 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: activeUser.id },
      data: { passwordHash: 'new-hashed-password' },
    });
    expect(prisma.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: activeUser.id,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({ changed: true });
  });

  it('rejects change password when current password is wrong', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUser);
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      service.changePassword(activeUser.id, {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewStrongPassword123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('uses the same unauthorized error for unknown identifier and wrong password', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.login({ identifier: 'missing_user', password: 'StrongPassword123!' }),
    ).rejects.toThrow(UnauthorizedException);

    prisma.user.findFirst.mockResolvedValueOnce(activeUser);
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      service.login({ identifier: 'user_name', password: 'WrongPassword123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects disabled users during login', async () => {
    prisma.user.findFirst.mockResolvedValue({ ...activeUser, status: 'disabled' });

    await expect(
      service.login({ identifier: 'user_name', password: 'StrongPassword123!' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns the current user by id without passwordHash', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUser);

    const result = await service.getCurrentUser(activeUser.id);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: activeUser.id },
    });
    expect(result).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      username: activeUser.username,
      displayName: activeUser.displayName,
      avatarUrl: null,
      createdAt: activeUser.createdAt,
      updatedAt: activeUser.updatedAt,
    });
  });
});
