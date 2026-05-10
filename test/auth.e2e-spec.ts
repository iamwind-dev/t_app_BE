import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { applyE2eAppConfig, TestJwtAuthGuard, testUser } from './e2e-test-utils';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    changePassword: jest.Mock;
    getCurrentUser: jest.Mock;
  };

  const publicUser = {
    id: testUser.id,
    email: 'user@example.com',
    username: 'user_name',
    displayName: 'User Name',
    avatarUrl: null,
    createdAt: new Date('2026-04-24T14:00:00.000Z'),
    updatedAt: new Date('2026-04-24T14:00:00.000Z'),
  };
  const authResponse = {
    user: publicUser,
    accessToken: 'jwt.access.token',
    refreshToken: 'refresh.token',
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      getCurrentUser: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    applyE2eAppConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers with normalized DTO input and wraps the auth response', async () => {
    authService.register.mockResolvedValue(authResponse);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: ' USER@EXAMPLE.COM ',
        username: ' user_name ',
        password: 'StrongPassword123',
        displayName: ' User Name ',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(authService.register).toHaveBeenCalledWith({
          email: 'user@example.com',
          username: 'user_name',
          password: 'StrongPassword123',
          displayName: 'User Name',
        });
        expect(body).toEqual({
          success: true,
          data: {
            ...authResponse,
            user: {
              ...publicUser,
              createdAt: publicUser.createdAt.toISOString(),
              updatedAt: publicUser.updatedAt.toISOString(),
            },
          },
        });
        expect(body.data.user).not.toHaveProperty('passwordHash');
      });
  });

  it('logs in with trimmed identifier', async () => {
    authService.login.mockResolvedValue(authResponse);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: ' user_name ', password: 'StrongPassword123' })
      .expect(200)
      .expect(({ body }) => {
        expect(authService.login).toHaveBeenCalledWith({
          identifier: 'user_name',
          password: 'StrongPassword123',
        });
        expect(body.data.accessToken).toBe('jwt.access.token');
        expect(body.data.refreshToken).toBe('refresh.token');
      });
  });

  it('refreshes tokens with a refresh token body', async () => {
    authService.refresh.mockResolvedValue({
      accessToken: 'new.jwt.access.token',
      refreshToken: 'new.refresh.token',
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'x'.repeat(48) })
      .expect(200)
      .expect(({ body }) => {
        expect(authService.refresh).toHaveBeenCalledWith({ refreshToken: 'x'.repeat(48) });
        expect(body.data).toEqual({
          accessToken: 'new.jwt.access.token',
          refreshToken: 'new.refresh.token',
        });
      });
  });

  it('logs out by revoking a refresh token', async () => {
    authService.logout.mockResolvedValue({ loggedOut: true });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: 'x'.repeat(48) })
      .expect(200)
      .expect(({ body }) => {
        expect(authService.logout).toHaveBeenCalledWith({ refreshToken: 'x'.repeat(48) });
        expect(body.data.loggedOut).toBe(true);
      });
  });

  it('changes password with JWT auth context', async () => {
    authService.changePassword.mockResolvedValue({ changed: true });

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentPassword: 'StrongPassword123',
        newPassword: 'NewStrongPassword123',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(authService.changePassword).toHaveBeenCalledWith(testUser.id, {
          currentPassword: 'StrongPassword123',
          newPassword: 'NewStrongPassword123',
        });
        expect(body.data.changed).toBe(true);
      });
  });

  it('returns the current user with JWT auth context', async () => {
    authService.getCurrentUser.mockResolvedValue(publicUser);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(authService.getCurrentUser).toHaveBeenCalledWith(testUser.id);
        expect(body.data.user.email).toBe('user@example.com');
      });
  });

  it('rejects invalid register input before reaching the service', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bad', username: 'x', password: 'short' })
      .expect(400)
      .expect(({ body }) => {
        expect(authService.register).not.toHaveBeenCalled();
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('rejects /auth/me without JWT', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401)
      .expect(({ body }) => {
        expect(authService.getCurrentUser).not.toHaveBeenCalled();
        expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
      });
  });
});
