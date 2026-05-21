import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { InternalOpsGuard } from '../src/common/guards/internal-ops.guard';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DomainEventsController } from '../src/domain-events/domain-events.controller';
import { DomainEventsService } from '../src/domain-events/domain-events.service';
import { OutboxPublisherService } from '../src/domain-events/outbox-publisher.service';
import { RealtimeEventsService } from '../src/domain-events/realtime-events.service';
import { RealtimeGateway } from '../src/domain-events/realtime.gateway';
import { applyE2eAppConfig, TestJwtAuthGuard, testUser } from './e2e-test-utils';

describe('Realtime reconnect contract (e2e)', () => {
  let app: INestApplication;
  let authService: { refresh: jest.Mock };
  let domainEventsService: { listEventsForSync: jest.Mock };
  let gateway: RealtimeGateway;

  beforeEach(async () => {
    process.env.INTERNAL_OPS_TOKEN = 'internal-token-for-tests';

    authService = {
      refresh: jest.fn(),
    };

    domainEventsService = {
      listEventsForSync: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, DomainEventsController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refresh: authService.refresh,
            logout: jest.fn(),
            changePassword: jest.fn(),
            getCurrentUser: jest.fn(),
          },
        },
        {
          provide: DomainEventsService,
          useValue: {
            createEvent: jest.fn(),
            markPublished: jest.fn(),
            listUnpublishedEvents: jest.fn(),
            countUnpublishedEvents: jest.fn().mockResolvedValue(0),
            getOldestUnpublishedEventMeta: jest.fn().mockResolvedValue(null),
            listPendingOutboxEvents: jest.fn().mockResolvedValue([]),
            listEventsForSync: domainEventsService.listEventsForSync,
          },
        },
        {
          provide: OutboxPublisherService,
          useValue: {
            getStats: jest.fn().mockReturnValue({
              isRunning: false,
              startedAt: new Date().toISOString(),
              intervalMs: 3000,
              batchSize: 100,
              lastTickAt: null,
              lastTickDurationMs: 0,
              lastTickPendingCount: 0,
              lastTickProcessedCount: 0,
              totalPublishedSuccess: 0,
              totalPublishFail: 0,
              totalRetryCount: 0,
            }),
          },
        },
        InternalOpsGuard,
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

    gateway = new RealtimeGateway(
      {
        verifyAsync: jest
          .fn()
          .mockRejectedValue({ name: 'TokenExpiredError', message: 'jwt expired' }),
      } as unknown as JwtService,
      { bindServer: jest.fn() } as unknown as RealtimeEventsService,
    );
    gateway.server = {} as never;
  });

  afterEach(async () => {
    await app.close();
    delete process.env.INTERNAL_OPS_TOKEN;
  });

  it('handles AUTH_TOKEN_EXPIRED then refresh then sync/events with sinceEventId', async () => {
    const socket = {
      id: 'socket-1',
      data: {},
      handshake: { auth: { token: 'expired-token' }, headers: {} },
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
    };

    await gateway.handleConnection(socket as never);
    expect(socket.emit).toHaveBeenCalledWith('auth_error', {
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Access token is invalid or expired.',
    });

    authService.refresh.mockResolvedValue({
      accessToken: 'new.jwt.access.token',
      refreshToken: 'new.refresh.token',
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'x'.repeat(48) })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.accessToken).toBe('new.jwt.access.token');
      });

    domainEventsService.listEventsForSync.mockResolvedValue([
      {
        eventId: 'eeeeeeee-1111-4444-8888-aaaaaaaaaaaa',
        type: 'user.profile.updated',
        orderingValue:
          '2026-05-21T12:00:00.000Z#eeeeeeee-1111-4444-8888-aaaaaaaaaaaa',
        occurredAt: '2026-05-21T12:00:00.000Z',
        actorId: testUser.id,
        subjectType: 'USER',
        subjectId: testUser.id,
        orderingKey: `USER:${testUser.id}`,
        rooms: [`user:${testUser.id}`, 'feed:global'],
        payload: {
          userId: testUser.id,
          displayName: 'New Name',
          avatarUrl: 'https://cdn.example.com/avatar.jpg',
          version: '2026-05-21T12:00:00.000Z',
        },
      },
    ]);

    await request(app.getHttpServer())
      .get('/sync/events')
      .set('Authorization', 'Bearer new.jwt.access.token')
      .query({
        sinceEventId: 'eeeeeeee-0000-4444-8888-aaaaaaaaaaaa',
        rooms: 'feed:global',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(domainEventsService.listEventsForSync).toHaveBeenCalledWith(testUser.id, {
          sinceEventId: 'eeeeeeee-0000-4444-8888-aaaaaaaaaaaa',
          sinceOccurredAt: undefined,
          limit: undefined,
          rooms: ['feed:global'],
        });
        expect(body.data.items[0]).toEqual(
          expect.objectContaining({
            eventId: expect.any(String),
            orderingValue: expect.any(String),
            occurredAt: expect.any(String),
            orderingKey: expect.any(String),
            payload: expect.any(Object),
          }),
        );
      });
  });
});
