import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse, PublicAuthUser } from './types/auth-user.type';
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

@Injectable()
export class AuthService {
  private readonly bcryptSaltRounds = 12;

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
    const accessToken = await this.jwtService.signAsync({ sub: user.id });

    return {
      user: this.toPublicUser(user),
      accessToken,
    };
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
