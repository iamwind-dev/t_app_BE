import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ReelsController } from '../src/reels/reels.controller';
import { ReelsService } from '../src/reels/reels.service';
import { applyE2eAppConfig, TestJwtAuthGuard, testUser } from './e2e-test-utils';

describe('Reels API (e2e)', () => {
  let app: INestApplication;
  let reelsService: {
    createReel: jest.Mock;
    getFeed: jest.Mock;
    getReelById: jest.Mock;
    likeReel: jest.Mock;
    unlikeReel: jest.Mock;
    listComments: jest.Mock;
    createComment: jest.Mock;
    deleteReel: jest.Mock;
  };

  const reelId = '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1';
  const createdAt = new Date('2026-05-23T14:00:00.000Z');
  const reel = {
    id: reelId,
    caption: 'A short reel.',
    videoUrl: 'https://cdn.example.com/reels/video.mp4',
    thumbnailUrl: null,
    audioTitle: 'Original audio',
    durationSeconds: 30,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    moderationStatus: 'approved',
    createdAt,
    author: {
      id: testUser.id,
      username: testUser.username,
      displayName: 'Me',
      avatarUrl: null,
    },
    isLikedByMe: false,
  };
  const commentId = '6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32';
  const comment = {
    id: commentId,
    reelId,
    author: {
      id: testUser.id,
      username: testUser.username,
      displayName: 'Me',
      avatarUrl: null,
    },
    content: 'Nice reel.',
    likeCount: 0,
    moderationStatus: 'approved',
    createdAt,
    isLikedByMe: false,
  };

  beforeEach(async () => {
    reelsService = {
      createReel: jest.fn(),
      getFeed: jest.fn(),
      getReelById: jest.fn(),
      likeReel: jest.fn(),
      unlikeReel: jest.fn(),
      listComments: jest.fn(),
      createComment: jest.fn(),
      deleteReel: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReelsController],
      providers: [
        { provide: ReelsService, useValue: reelsService },
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

  function server(): Parameters<typeof request>[0] {
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  it('creates a reel with trimmed caption and audio title', async () => {
    reelsService.createReel.mockResolvedValue({ reel });

    await request(server())
      .post('/reels')
      .set('Authorization', 'Bearer test-token')
      .send({
        videoUrl: reel.videoUrl,
        caption: ' A short reel. ',
        audioTitle: ' Original audio ',
        durationSeconds: 30,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(reelsService.createReel).toHaveBeenCalledWith(testUser.id, {
          videoUrl: reel.videoUrl,
          caption: 'A short reel.',
          audioTitle: 'Original audio',
          durationSeconds: 30,
        });
        expect(body.data.reel.createdAt).toBe(createdAt.toISOString());
      });
  });

  it('lists reel feed with transformed pagination query', async () => {
    reelsService.getFeed.mockResolvedValue({
      items: [reel],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    await request(server())
      .get('/reels/feed?limit=20')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(reelsService.getFeed).toHaveBeenCalledWith(testUser.id, { limit: 20 });
        expect(body.data.items).toHaveLength(1);
      });
  });

  it('gets and soft deletes a reel by id', async () => {
    reelsService.getReelById.mockResolvedValue({ reel });
    reelsService.deleteReel.mockResolvedValue({
      deleted: true,
      id: reelId,
      deletedAt: createdAt,
    });

    await request(server())
      .get(`/reels/${reelId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(reelsService.getReelById).toHaveBeenCalledWith(testUser.id, reelId);

    await request(server())
      .delete(`/reels/${reelId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.deleted).toBe(true);
      });
    expect(reelsService.deleteReel).toHaveBeenCalledWith(testUser.id, reelId);
  });

  it('likes and unlikes a reel by id', async () => {
    reelsService.likeReel.mockResolvedValue({
      reelId,
      likeCount: 1,
      isLiked: true,
    });
    reelsService.unlikeReel.mockResolvedValue({
      reelId,
      likeCount: 0,
      isLiked: false,
    });

    await request(server())
      .post(`/reels/${reelId}/like`)
      .set('Authorization', 'Bearer test-token')
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.isLiked).toBe(true);
      });
    expect(reelsService.likeReel).toHaveBeenCalledWith(testUser.id, reelId);

    await request(server())
      .delete(`/reels/${reelId}/like`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.isLiked).toBe(false);
      });
    expect(reelsService.unlikeReel).toHaveBeenCalledWith(testUser.id, reelId);
  });

  it('lists and creates one-level reel comments', async () => {
    reelsService.listComments.mockResolvedValue({
      items: [comment],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    reelsService.createComment.mockResolvedValue({ comment });

    await request(server())
      .get(`/reels/${reelId}/comments?limit=20`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(reelsService.listComments).toHaveBeenCalledWith(testUser.id, reelId, {
          limit: 20,
        });
        expect(body.data.items).toHaveLength(1);
      });

    await request(server())
      .post(`/reels/${reelId}/comments`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: ' Nice reel. ' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.comment.content).toBe('Nice reel.');
      });
    expect(reelsService.createComment).toHaveBeenCalledWith(testUser.id, reelId, {
      content: 'Nice reel.',
    });
  });

  it('rejects missing JWT and invalid params/query', async () => {
    await request(server()).get('/reels/feed').expect(401);

    await request(server())
      .get('/reels/not-a-uuid')
      .set('Authorization', 'Bearer test-token')
      .expect(400);

    await request(server())
      .get('/reels/feed?limit=99')
      .set('Authorization', 'Bearer test-token')
      .expect(400);
  });
});
