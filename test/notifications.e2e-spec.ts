import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { NotificationsService } from '../src/notifications/notifications.service';

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.headers.authorization) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }

    request.user = {
      id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      email: 'me@example.com',
      username: 'me',
    };

    return true;
  }
}

describe('Notifications API (e2e)', () => {
  let app: INestApplication;
  let notificationsService: {
    getUnreadCount: jest.Mock;
    listNotifications: jest.Mock;
    markAsRead: jest.Mock;
    markAllAsRead: jest.Mock;
  };

  const currentUserId = '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
  const notificationId = '6e78f9f5-1bb5-497f-96ec-4465c7fcd74a';
  const postId = '83052a85-52f0-47f8-b94e-f1ca1c7f6903';
  const actor = {
    id: '02d50f39-eef6-4edb-85c0-2dd8d020df3a',
    username: 'other_user',
    displayName: 'Other User',
    avatarUrl: null,
  };
  const createdAt = new Date('2026-04-24T14:00:00.000Z');
  const updatedAt = new Date('2026-04-24T14:01:00.000Z');
  const readAt = new Date('2026-04-24T15:00:00.000Z');
  const notification = {
    id: notificationId,
    type: 'LIKE',
    recipientId: currentUserId,
    actor,
    target: {
      type: 'POST',
      id: postId,
    },
    message: 'Other User liked your post.',
    metadata: {
      postPreview: 'Hello from Threads-like app.',
    },
    readAt: null,
    createdAt,
    updatedAt,
  };

  beforeEach(async () => {
    notificationsService = {
      getUnreadCount: jest.fn(),
      listNotifications: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: APP_FILTER,
          useClass: HttpExceptionFilter,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
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
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns unread count for the authenticated user', async () => {
    notificationsService.getUnreadCount.mockResolvedValue({ unreadCount: 3 });

    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(notificationsService.getUnreadCount).toHaveBeenCalledWith(currentUserId);
        expect(body).toEqual({
          success: true,
          data: {
            unreadCount: 3,
          },
        });
      });
  });

  it('lists notifications with validated query params and public actor shape', async () => {
    notificationsService.listNotifications.mockResolvedValue({
      items: [notification],
      pageInfo: {
        nextCursor: null,
        hasNextPage: false,
      },
    });

    await request(app.getHttpServer())
      .get('/notifications?limit=20&unreadOnly=true')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(notificationsService.listNotifications).toHaveBeenCalledWith(currentUserId, {
          limit: 20,
          unreadOnly: true,
        });
        expect(body.data.items[0]).toEqual({
          ...notification,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        });
        expect(body.data.items[0].actor).not.toHaveProperty('email');
        expect(body.data.items[0].actor).not.toHaveProperty('passwordHash');
      });
  });

  it('marks one notification as read', async () => {
    notificationsService.markAsRead.mockResolvedValue({
      notification: {
        ...notification,
        readAt,
      },
    });

    await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(notificationsService.markAsRead).toHaveBeenCalledWith(
          currentUserId,
          notificationId,
        );
        expect(body.data.notification.readAt).toBe(readAt.toISOString());
      });
  });

  it('marks all current-user notifications as read', async () => {
    notificationsService.markAllAsRead.mockResolvedValue({ updatedCount: 2 });

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(currentUserId);
        expect(body).toEqual({
          success: true,
          data: {
            updatedCount: 2,
          },
        });
      });
  });

  it('rejects missing JWT before reaching the service', async () => {
    await request(app.getHttpServer())
      .get('/notifications')
      .expect(401)
      .expect(({ body }) => {
        expect(notificationsService.listNotifications).not.toHaveBeenCalled();
        expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
      });
  });

  it('rejects invalid notification query params', async () => {
    await request(app.getHttpServer())
      .get('/notifications?limit=99&unreadOnly=maybe')
      .set('Authorization', 'Bearer test-token')
      .expect(400)
      .expect(({ body }) => {
        expect(notificationsService.listNotifications).not.toHaveBeenCalled();
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('rejects invalid notification id params', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/not-a-uuid/read')
      .set('Authorization', 'Bearer test-token')
      .expect(400)
      .expect(({ body }) => {
        expect(notificationsService.markAsRead).not.toHaveBeenCalled();
        expect(body.error.message).toContain('Invalid notification id.');
      });
  });
});

