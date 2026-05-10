import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthResponse,
  ChangePasswordResponse,
  LogoutResponse,
  PublicAuthUser,
  TokenRefreshResponse,
} from './types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';

interface AuthUserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUserRecord;
}

@Injectable()
export class AuthService {
  private readonly bcryptSaltRounds = 12;
  private readonly refreshTokenTtlDays = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const username = dto.username.trim();
    const displayName = this.normalizeDisplayName(dto.displayName, username);

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException({
          code: 'AUTH_EMAIL_TAKEN',
          message: 'Email is already registered.',
        });
      }

      throw new ConflictException({
        code: 'AUTH_USERNAME_TAKEN',
        message: 'Username is already taken.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          username,
          passwordHash,
          displayName,
        },
      });

      return this.buildAuthResponse(user);
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const identifier = dto.identifier.trim();
    const normalizedEmail = this.normalizeEmail(identifier);

    const user = (await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: identifier }],
      },
    })) as AuthUserRecord | null;

    if (!user) {
      throw this.invalidCredentialsException();
    }

    this.assertUserCanAuthenticate(user);

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw this.invalidCredentialsException();
    }

    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenRefreshResponse> {
    const existingToken = (await this.prisma.authRefreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(dto.refreshToken) },
      include: { user: true },
    })) as RefreshTokenRecord | null;

    if (!existingToken || existingToken.revokedAt || existingToken.expiresAt <= new Date()) {
      throw this.invalidRefreshTokenException();
    }

    this.assertUserCanAuthenticate(existingToken.user);

    const accessToken = await this.signAccessToken(existingToken.user.id);
    const nextRefreshToken = this.generateRefreshToken();
    const nextTokenHash = this.hashRefreshToken(nextRefreshToken);
    const nextExpiresAt = this.refreshTokenExpiresAt();

    await this.prisma.$transaction(async (tx) => {
      const createdToken = await tx.authRefreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: nextTokenHash,
          expiresAt: nextExpiresAt,
        },
        select: { id: true },
      });

      await tx.authRefreshToken.update({
        where: { id: existingToken.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: createdToken.id,
        },
      });
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
    };
  }

  async logout(dto: RefreshTokenDto): Promise<LogoutResponse> {
    await this.prisma.authRefreshToken.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(dto.refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { loggedOut: true };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as AuthUserRecord | null;

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid or expired token.',
      });
    }

    this.assertUserCanAuthenticate(user);

    const passwordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptSaltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.authRefreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return { changed: true };
  }

  async getCurrentUser(userId: string): Promise<PublicAuthUser> {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as AuthUserRecord | null;

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid or expired token.',
      });
    }

    this.assertUserCanAuthenticate(user);
    return this.toPublicUser(user);
  }

  private async buildAuthResponse(user: AuthUserRecord): Promise<AuthResponse> {
    const accessToken = await this.signAccessToken(user.id);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: this.toPublicUser(user),
      accessToken,
      refreshToken,
    };
  }

  private signAccessToken(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId });
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const refreshToken = this.generateRefreshToken();

    await this.prisma.authRefreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.refreshTokenExpiresAt(),
      },
    });

    return refreshToken;
  }

  private toPublicUser(user: AuthUserRecord): PublicAuthUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeDisplayName(displayName: string | undefined, username: string): string {
    const normalizedDisplayName = displayName?.trim();
    return normalizedDisplayName && normalizedDisplayName.length > 0
      ? normalizedDisplayName
      : username;
  }

  private assertUserCanAuthenticate(user: AuthUserRecord): void {
    if (user.deletedAt || user.status !== 'active') {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_DISABLED',
        message: 'Account is not active.',
      });
    }
  }

  private invalidCredentialsException(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email, username, or password.',
    });
  }

  private invalidRefreshTokenException(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_INVALID_REFRESH_TOKEN',
      message: 'Refresh token is invalid or expired.',
    });
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private refreshTokenExpiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);
    return expiresAt;
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (!this.isPrismaUniqueConstraintError(error)) {
      return;
    }

    const target = error.meta?.target;
    const targetFields = Array.isArray(target) ? target : [];

    if (targetFields.includes('email')) {
      throw new ConflictException({
        code: 'AUTH_EMAIL_TAKEN',
        message: 'Email is already registered.',
      });
    }

    if (targetFields.includes('username')) {
      throw new ConflictException({
        code: 'AUTH_USERNAME_TAKEN',
        message: 'Username is already taken.',
      });
    }
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
}
