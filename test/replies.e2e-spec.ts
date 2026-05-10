import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../src/auth/guards/optional-jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { RepliesController } from '../src/replies/replies.controller';
import { RepliesService } from '../src/replies/replies.service';
import {
  applyE2eAppConfig,
  TestJwtAuthGuard,
  TestOptionalJwtAuthGuard,
  testUser,
} from './e2e-test-utils';

describe('Replies API (e2e)', () => {
  let app: INestApplication;
  let repliesService: {
    createPostReply: jest.Mock;
    createChildReply: jest.Mock;
    listPostReplies: jest.Mock;
    listChildReplies: jest.Mock;
    getReplyById: jest.Mock;
    updateReply: jest.Mock;
    deleteReply: jest.Mock;
  };

  const postId = '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1';
  const replyId = '6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32';
  const createdAt = new Date('2026-04-24T14:00:00.000Z');
  const reply = {
    id: replyId,
    postId,
    parentReplyId: null,
    author: {
      id: testUser.id,
      username: testUser.username,
      displayName: 'Me',
      avatarUrl: null,
    },
    content: 'Hello reply.',
    mediaUrls: [],
    likeCount: 0,
    childReplyCount: 0,
    moderationStatus: 'approved',
    createdAt,
    isLikedByMe: false,
  };

  beforeEach(async () => {
    repliesService = {
      createPostReply: jest.fn(),
      createChildReply: jest.fn(),
      listPostReplies: jest.fn(),
      listChildReplies: jest.fn(),
      getReplyById: jest.fn(),
      updateReply: jest.fn(),
      deleteReply: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RepliesController],
      providers: [
        { provide: RepliesService, useValue: repliesService },
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

  it('creates post and child replies with JWT auth context', async () => {
    repliesService.createPostReply.mockResolvedValue({ reply });
    repliesService.createChildReply.mockResolvedValue({
      reply: { ...reply, parentReplyId: replyId },
    });

    await request(app.getHttpServer())
      .post(`/posts/${postId}/replies`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: ' Hello reply. ' })
      .expect(201);
    expect(repliesService.createPostReply).toHaveBeenCalledWith(testUser.id, postId, {
      content: 'Hello reply.',
    });

    await request(app.getHttpServer())
      .post(`/replies/${replyId}/replies`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: ' Child reply. ' })
      .expect(201);
    expect(repliesService.createChildReply).toHaveBeenCalledWith(testUser.id, replyId, {
      content: 'Child reply.',
    });
  });

  it('lists and gets replies with optional auth context', async () => {
    repliesService.listPostReplies.mockResolvedValue({
      items: [reply],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    repliesService.listChildReplies.mockResolvedValue({
      items: [{ ...reply, parentReplyId: replyId }],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    repliesService.getReplyById.mockResolvedValue({ reply });

    await request(app.getHttpServer())
      .get(`/posts/${postId}/replies?limit=20`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(repliesService.listPostReplies).toHaveBeenCalledWith(testUser.id, postId, {
      limit: 20,
    });

    await request(app.getHttpServer()).get(`/replies/${replyId}/children`).expect(200);
    expect(repliesService.listChildReplies).toHaveBeenCalledWith(
      undefined,
      replyId,
      expect.objectContaining({ limit: 20 }),
    );

    await request(app.getHttpServer())
      .get(`/replies/${replyId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(repliesService.getReplyById).toHaveBeenCalledWith(testUser.id, replyId);
  });

  it('updates and soft deletes replies with ownership service calls', async () => {
    repliesService.updateReply.mockResolvedValue({ reply: { ...reply, content: 'Updated.' } });
    repliesService.deleteReply.mockResolvedValue({
      deleted: true,
      id: replyId,
      deletedAt: createdAt,
    });

    await request(app.getHttpServer())
      .patch(`/replies/${replyId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: ' Updated. ' })
      .expect(200);
    expect(repliesService.updateReply).toHaveBeenCalledWith(testUser.id, replyId, {
      content: 'Updated.',
    });

    await request(app.getHttpServer())
      .delete(`/replies/${replyId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(repliesService.deleteReply).toHaveBeenCalledWith(testUser.id, replyId);
  });

  it('rejects missing JWT and invalid reply params/query', async () => {
    await request(app.getHttpServer()).post(`/posts/${postId}/replies`).send({ content: 'x' }).expect(401);

    await request(app.getHttpServer())
      .get('/replies/not-a-uuid')
      .set('Authorization', 'Bearer test-token')
      .expect(400);

    await request(app.getHttpServer())
      .get(`/posts/${postId}/replies?limit=99`)
      .expect(400);
  });
});
