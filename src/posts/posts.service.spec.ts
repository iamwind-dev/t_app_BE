import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';

type MockPrismaService = {
  $transaction: jest.Mock;
  post: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  user: {
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

type MockPost = {
  id: string;
  authorId: string;
  content: string | null;
  mediaUrls: string[];
  likeCount: number;
  replyCount: number;
  moderationStatus: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  reactions: Array<{ id: string }>;
};

describe('PostsService', () => {
  let service: PostsService;
  let prisma: MockPrismaService;

  const author = {
    id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
    username: 'user_name',
    displayName: 'User Name',
    avatarUrl: null,
  };
  const createdAt = new Date('2026-04-24T14:00:00.000Z');
  const post: MockPost = {
    id: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
    authorId: author.id,
    content: 'Hello from posts.',
    mediaUrls: [],
    likeCount: 3,
    replyCount: 2,
    moderationStatus: 'APPROVED',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    author,
    reactions: [],
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback({
            post: prisma.post,
            user: prisma.user,
          });
        }

        return callback;
      }),
      post: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    service = new PostsService(prisma as unknown as PrismaService);
  });

  it('creates a post for the authenticated user and trims content', async () => {
    prisma.post.create.mockResolvedValue(post);
    prisma.user.update.mockResolvedValue({ id: author.id });

    const result = await service.createPost(author.id, {
      content: '  Hello from posts.  ',
      mediaUrls: [],
    });

    expect(prisma.post.create).toHaveBeenCalledWith({
      data: {
        authorId: author.id,
        content: 'Hello from posts.',
        mediaUrls: [],
        moderationStatus: 'APPROVED',
      },
      include: expect.any(Object),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: author.id },
      data: {
        postCount: {
          increment: 1,
        },
      },
    });
    expect(result).toEqual({
      post: {
        id: post.id,
        content: post.content,
        mediaUrls: [],
        moderationStatus: 'approved',
        createdAt,
        author,
        likeCount: 3,
        replyCount: 2,
        isLikedByMe: false,
      },
    });
  });

  it('rejects creating an empty post without content or media', async () => {
    await expect(service.createPost(author.id, { content: '   ', mediaUrls: [] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns feed items without deleted posts and computes isLikedByMe', async () => {
    prisma.post.findMany.mockResolvedValue([{ ...post, reactions: [{ id: 'reaction-id' }] }]);

    const result = await service.getFeed(author.id, { limit: 20 });

    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        moderationStatus: {
          not: 'REJECTED',
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      cursor: undefined,
      skip: undefined,
      include: expect.any(Object),
    });
    expect(result.items[0]?.isLikedByMe).toBe(true);
    expect(result.pageInfo).toEqual({
      nextCursor: null,
      hasNextPage: false,
    });
  });

  it('returns post detail with author and reaction state', async () => {
    prisma.post.findFirst.mockResolvedValue({ ...post, reactions: [{ id: 'reaction-id' }] });

    const result = await service.getPostById(author.id, post.id);

    expect(prisma.post.findFirst).toHaveBeenCalledWith({
      where: {
        id: post.id,
        deletedAt: null,
      },
      include: expect.any(Object),
    });
    expect(result.post.isLikedByMe).toBe(true);
    expect(result.post).not.toHaveProperty('moderationScore');
    expect(result.post).not.toHaveProperty('moderationReason');
  });

  it('allows only the author to update a post', async () => {
    prisma.post.findFirst.mockResolvedValue(post);
    prisma.post.update.mockResolvedValue({
      ...post,
      content: 'Updated content.',
      reactions: [],
    });

    const result = await service.updatePost(author.id, post.id, {
      content: ' Updated content. ',
    });

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: post.id },
      data: {
        content: 'Updated content.',
      },
      include: expect.any(Object),
    });
    expect(result.post.content).toBe('Updated content.');
  });

  it('rejects update by a non-author', async () => {
    prisma.post.findFirst.mockResolvedValue(post);

    await expect(
      service.updatePost('another-user-id', post.id, { content: 'Nope.' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('soft deletes an author-owned post', async () => {
    const deletedAt = new Date('2026-04-24T15:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation(() => deletedAt);
    prisma.post.findFirst.mockResolvedValue(post);
    prisma.post.update.mockResolvedValue({ ...post, deletedAt });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.deletePost(author.id, post.id);

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: post.id },
      data: { deletedAt },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: author.id,
        postCount: {
          gt: 0,
        },
      },
      data: {
        postCount: {
          decrement: 1,
        },
      },
    });
    expect(result).toEqual({
      deleted: true,
      id: post.id,
      deletedAt,
    });

    jest.restoreAllMocks();
  });

  it('returns not found for missing or deleted posts', async () => {
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(service.getPostById(author.id, post.id)).rejects.toThrow(NotFoundException);
  });
});
