import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PostsController } from '../src/posts/posts.controller';
import { PostsService } from '../src/posts/posts.service';
import { applyE2eAppConfig, TestJwtAuthGuard, testUser } from './e2e-test-utils';

describe('Posts API (e2e)', () => {
  let app: INestApplication;
  let postsService: {
    createPost: jest.Mock;
    getFeed: jest.Mock;
    getPostById: jest.Mock;
    updatePost: jest.Mock;
    deletePost: jest.Mock;
  };

  const postId = '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1';
  const createdAt = new Date('2026-04-24T14:00:00.000Z');
  const post = {
    id: postId,
    content: 'Hello from posts.',
    mediaUrls: [],
    moderationStatus: 'approved',
    createdAt,
    author: {
      id: testUser.id,
      username: testUser.username,
      displayName: 'Me',
      avatarUrl: null,
    },
    likeCount: 0,
    replyCount: 0,
    isLikedByMe: false,
  };

  beforeEach(async () => {
    postsService = {
      createPost: jest.fn(),
      getFeed: jest.fn(),
      getPostById: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        { provide: PostsService, useValue: postsService },
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

  it('creates a post with trimmed content from the authenticated user', async () => {
    postsService.createPost.mockResolvedValue({ post });

    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', 'Bearer test-token')
      .send({ content: ' Hello from posts. ' })
      .expect(201)
      .expect(({ body }) => {
        expect(postsService.createPost).toHaveBeenCalledWith(testUser.id, {
          content: 'Hello from posts.',
        });
        expect(body.data.post.createdAt).toBe(createdAt.toISOString());
      });
  });

  it('lists feed posts with transformed pagination query', async () => {
    postsService.getFeed.mockResolvedValue({
      items: [post],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    await request(app.getHttpServer())
      .get('/posts/feed?limit=20')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(postsService.getFeed).toHaveBeenCalledWith(testUser.id, { limit: 20 });
        expect(body.data.items).toHaveLength(1);
      });
  });

  it('gets, updates, and soft deletes a post by id', async () => {
    postsService.getPostById.mockResolvedValue({ post });
    postsService.updatePost.mockResolvedValue({ post: { ...post, content: 'Updated.' } });
    postsService.deletePost.mockResolvedValue({
      deleted: true,
      id: postId,
      deletedAt: createdAt,
    });

    await request(app.getHttpServer())
      .get(`/posts/${postId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(postsService.getPostById).toHaveBeenCalledWith(testUser.id, postId);

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: ' Updated. ' })
      .expect(200);
    expect(postsService.updatePost).toHaveBeenCalledWith(testUser.id, postId, {
      content: 'Updated.',
    });

    await request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.deleted).toBe(true);
      });
    expect(postsService.deletePost).toHaveBeenCalledWith(testUser.id, postId);
  });

  it('rejects missing JWT and invalid params/query', async () => {
    await request(app.getHttpServer()).get('/posts/feed').expect(401);

    await request(app.getHttpServer())
      .get('/posts/not-a-uuid')
      .set('Authorization', 'Bearer test-token')
      .expect(400);

    await request(app.getHttpServer())
      .get('/posts/feed?limit=99')
      .set('Authorization', 'Bearer test-token')
      .expect(400);
  });
});

