import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../src/auth/guards/optional-jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { FollowsController } from '../src/follows/follows.controller';
import { FollowsService } from '../src/follows/follows.service';
import {
  applyE2eAppConfig,
  TestJwtAuthGuard,
  TestOptionalJwtAuthGuard,
  testUser,
} from './e2e-test-utils';

describe('Follows API (e2e)', () => {
  let app: INestApplication;
  let followsService: {
    followUser: jest.Mock;
    unfollowUser: jest.Mock;
    getFollowers: jest.Mock;
    getFollowing: jest.Mock;
  };

  const targetUserId = '02d50f39-eef6-4edb-85c0-2dd8d020df3a';
  const followedAt = new Date('2026-04-24T14:00:00.000Z');
  const targetProfile = {
    id: targetUserId,
    username: 'target_user',
    displayName: 'Target User',
    bio: null,
    avatarUrl: null,
    followersCount: 1,
    followingCount: 0,
    postCount: 0,
    isFollowing: true,
    createdAt: followedAt,
    updatedAt: followedAt,
  };
  const followItem = {
    id: testUser.id,
    username: testUser.username,
    displayName: 'Me',
    avatarUrl: null,
    bio: null,
    followersCount: 0,
    followingCount: 1,
    isFollowing: false,
    followedAt,
  };

  beforeEach(async () => {
    followsService = {
      followUser: jest.fn(),
      unfollowUser: jest.fn(),
      getFollowers: jest.fn(),
      getFollowing: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FollowsController],
      providers: [
        { provide: FollowsService, useValue: followsService },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .overrideGuard(OptionalJwtAuthGuard)
      .useClass(TestOptionalJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    applyE2eAppConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('follows and unfollows a user with JWT auth context', async () => {
    followsService.followUser.mockResolvedValue(targetProfile);
    followsService.unfollowUser.mockResolvedValue({ ...targetProfile, isFollowing: false });

    await request(app.getHttpServer())
      .post(`/users/${targetUserId}/follow`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.user.isFollowing).toBe(true);
      });
    expect(followsService.followUser).toHaveBeenCalledWith(testUser.id, targetUserId);

    await request(app.getHttpServer())
      .delete(`/users/${targetUserId}/follow`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.user.isFollowing).toBe(false);
      });
    expect(followsService.unfollowUser).toHaveBeenCalledWith(testUser.id, targetUserId);
  });

  it('lists followers and following with cursor pagination and optional auth', async () => {
    followsService.getFollowers.mockResolvedValue({
      items: [followItem],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    followsService.getFollowing.mockResolvedValue({
      items: [{ ...followItem, id: targetUserId, username: 'target_user', isFollowing: true }],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    await request(app.getHttpServer())
      .get(`/users/${targetUserId}/followers?limit=20`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(followsService.getFollowers).toHaveBeenCalledWith(
      targetUserId,
      { limit: 20 },
      testUser.id,
    );

    await request(app.getHttpServer())
      .get(`/users/${testUser.id}/following?limit=20`)
      .expect(200);
    expect(followsService.getFollowing).toHaveBeenCalledWith(testUser.id, { limit: 20 }, undefined);
  });

  it('rejects missing JWT for mutations and invalid follow list params', async () => {
    await request(app.getHttpServer()).post(`/users/${targetUserId}/follow`).expect(401);

    await request(app.getHttpServer())
      .get('/users/not-a-uuid/followers')
      .set('Authorization', 'Bearer test-token')
      .expect(400);

    await request(app.getHttpServer())
      .get(`/users/${targetUserId}/following?limit=99`)
      .expect(400);
  });
});
