import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';

export const testUser = {
  id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
  email: 'me@example.com',
  username: 'me',
};

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: typeof testUser;
}

export class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.headers.authorization) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }

    request.user = testUser;
    return true;
  }
}

export class TestOptionalJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (request.headers.authorization) {
      request.user = testUser;
    }

    return true;
  }
}

export function applyE2eAppConfig(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
}

