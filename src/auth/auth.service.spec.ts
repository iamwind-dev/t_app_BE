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
  user: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
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
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
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
    expect(result.user).not.toHaveProperty('passwordHash');
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
