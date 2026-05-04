import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RepliesService } from './replies.service';

type MockTransactionClient = {
  reply: {
    create: jest.Mock;
  };
  post: {
    update: jest.Mock;
  };
};

type MockPrismaService = {
  post: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  reply: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('RepliesService', () => {
  let service: RepliesService;
  let prisma: MockPrismaService;
  let notificationsService: {
    createReplyNotification: jest.Mock;
  };

  const userId = '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
  const postId = '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1';
  const replyId = '6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32';
  const createdAt = new Date('2026-04-24T14:00:00.000Z');
  const author = {
    id: userId,
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
  };
  const reply = {
    id: replyId,
    postId,
    parentReplyId: null,
    authorId: userId,
    content: 'Hello reply',
    mediaUrls: [],
    likeCount: 0,
    childReplyCount: 0,
    moderationStatus: 'APPROVED',
    createdAt,
    updatedAt: createdAt,
    author,
    reactions: [],
  };

  beforeEach(() => {
    const tx: MockTransactionClient = {
      reply: {
        create: jest.fn(),
      },
      post: {
        update: jest.fn(),
      },
    };

    prisma = {
      post: {
        findFirst: jest.fn(),
        update: tx.post.update,
      },
      reply: {
        create: tx.reply.create,
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: MockTransactionClient) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };

    notificationsService = {
      createReplyNotification: jest.fn(),
    };

    service = new RepliesService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('creates a post reply and increments the post reply count', async () => {
    prisma.post.findFirst.mockResolvedValue({
      id: postId,
      authorId: 'post-author-id',
      deletedAt: null,
    });
    prisma.reply.create.mockResolvedValue(reply);
    prisma.post.update.mockResolvedValue({ id: postId, replyCount: 1 });

    const result = await service.createPostReply(userId, postId, {
      content: '  Hello reply  ',
      mediaUrls: [],
    });

    expect(prisma.reply.create).toHaveBeenCalledWith({
      data: {
        postId,
        authorId: userId,
        content: 'Hello reply',
        mediaUrls: [],
        moderationStatus: 'APPROVED',
      },
      include: expect.any(Object),
    });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: { replyCount: { increment: 1 } },
      select: { replyCount: true },
    });
    expect(notificationsService.createReplyNotification).toHaveBeenCalledWith({
      actorId: userId,
      recipientId: 'post-author-id',
      targetType: 'POST',
      targetId: postId,
      replyId,
    });
    expect(result.reply).toEqual({
      id: replyId,
      postId,
      parentReplyId: null,
      author,
      content: 'Hello reply',
      mediaUrls: [],
      likeCount: 0,
      childReplyCount: 0,
      moderationStatus: 'approved',
      createdAt,
      isLikedByMe: false,
    });
  });

  it('rejects empty replies without content or media', async () => {
    await expect(
      service.createPostReply(userId, postId, { content: '   ', mediaUrls: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns not found when replying to a missing post', async () => {
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(
      service.createPostReply(userId, postId, { content: 'Hello' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists post replies with reaction state', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: postId, authorId: 'post-author-id' });
    prisma.reply.findMany.mockResolvedValue([{ ...reply, reactions: [{ id: 'reaction-id' }] }]);

    const result = await service.listPostReplies(userId, postId, { limit: 20 });

    expect(prisma.reply.findMany).toHaveBeenCalledWith({
      where: {
        postId,
        parentReplyId: null,
        deletedAt: null,
        moderationStatus: {
          not: 'REJECTED',
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 21,
      cursor: undefined,
      skip: undefined,
      include: expect.any(Object),
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.isLikedByMe).toBe(true);
    expect(result.pageInfo).toEqual({ nextCursor: null, hasNextPage: false });
  });
});
