import { NotFoundException } from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type MockTransactionClient = {
  postReaction: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  replyReaction: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  post: {
    update: jest.Mock;
  };
  reply: {
    update: jest.Mock;
  };
};

type MockPrismaService = {
  post: {
    findFirst: jest.Mock;
  };
  reply: {
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
} & MockTransactionClient;

describe('ReactionsService', () => {
  let service: ReactionsService;
  let prisma: MockPrismaService;
  let notificationsService: {
    createLikeNotification: jest.Mock;
  };

  const userId = '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
  const postId = '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1';
  const replyId = '6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32';

  beforeEach(() => {
    const tx: MockTransactionClient = {
      postReaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      replyReaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      post: {
        update: jest.fn(),
      },
      reply: {
        update: jest.fn(),
      },
    };

    prisma = {
      ...tx,
      post: {
        findFirst: jest.fn(),
        update: tx.post.update,
      },
      reply: {
        findFirst: jest.fn(),
        update: tx.reply.update,
      },
      $transaction: jest.fn((callback: (client: MockTransactionClient) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };

    notificationsService = {
      createLikeNotification: jest.fn(),
    };

    service = new ReactionsService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('likes a post once and increments likeCount', async () => {
    prisma.post.findFirst.mockResolvedValue({
      id: postId,
      authorId: 'post-author-id',
      likeCount: 11,
      deletedAt: null,
    });
    prisma.postReaction.findUnique.mockResolvedValue(null);
    prisma.postReaction.create.mockResolvedValue({ id: 'post-reaction-id' });
    prisma.post.update.mockResolvedValue({ id: postId, likeCount: 12 });

    const result = await service.likePost(userId, postId);

    expect(prisma.post.findFirst).toHaveBeenCalledWith({
      where: { id: postId, deletedAt: null },
      select: { id: true, authorId: true, likeCount: true },
    });
    expect(prisma.postReaction.create).toHaveBeenCalledWith({
      data: {
        postId,
        userId,
        type: 'LIKE',
      },
    });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    expect(notificationsService.createLikeNotification).toHaveBeenCalledWith({
      actorId: userId,
      recipientId: 'post-author-id',
      targetType: 'POST',
      targetId: postId,
      sourceType: 'POST_REACTION',
      sourceId: 'post-reaction-id',
    });
    expect(result).toEqual({ postId, likeCount: 12, isLiked: true });
  });

  it('does not duplicate an existing post like', async () => {
    prisma.post.findFirst.mockResolvedValue({
      id: postId,
      authorId: 'post-author-id',
      likeCount: 12,
      deletedAt: null,
    });
    prisma.postReaction.findUnique.mockResolvedValue({ id: 'reaction-id' });

    const result = await service.likePost(userId, postId);

    expect(prisma.postReaction.create).not.toHaveBeenCalled();
    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(notificationsService.createLikeNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ postId, likeCount: 12, isLiked: true });
  });

  it('unlikes a post and decrements likeCount without going below zero', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: postId, likeCount: 1, deletedAt: null });
    prisma.postReaction.findUnique.mockResolvedValue({ id: 'reaction-id' });
    prisma.post.update.mockResolvedValue({ id: postId, likeCount: 0 });

    const result = await service.unlikePost(userId, postId);

    expect(prisma.postReaction.delete).toHaveBeenCalledWith({
      where: {
        postId_userId_type: {
          postId,
          userId,
          type: 'LIKE',
        },
      },
    });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: { likeCount: 0 },
      select: { likeCount: true },
    });
    expect(result).toEqual({ postId, likeCount: 0, isLiked: false });
  });

  it('returns a valid unlike response when the post was not liked', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: postId, likeCount: 5, deletedAt: null });
    prisma.postReaction.findUnique.mockResolvedValue(null);

    const result = await service.unlikePost(userId, postId);

    expect(prisma.postReaction.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ postId, likeCount: 5, isLiked: false });
  });

  it('rejects likes for missing or deleted posts', async () => {
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(service.likePost(userId, postId)).rejects.toThrow(NotFoundException);
  });

  it('likes a reply once and increments likeCount', async () => {
    prisma.reply.findFirst.mockResolvedValue({
      id: replyId,
      authorId: 'reply-author-id',
      likeCount: 4,
      deletedAt: null,
    });
    prisma.replyReaction.findUnique.mockResolvedValue(null);
    prisma.replyReaction.create.mockResolvedValue({ id: 'reply-reaction-id' });
    prisma.reply.update.mockResolvedValue({ id: replyId, likeCount: 5 });

    const result = await service.likeReply(userId, replyId);

    expect(prisma.replyReaction.create).toHaveBeenCalledWith({
      data: {
        replyId,
        userId,
        type: 'LIKE',
      },
    });
    expect(notificationsService.createLikeNotification).toHaveBeenCalledWith({
      actorId: userId,
      recipientId: 'reply-author-id',
      targetType: 'REPLY',
      targetId: replyId,
      sourceType: 'REPLY_REACTION',
      sourceId: 'reply-reaction-id',
    });
    expect(result).toEqual({ replyId, likeCount: 5, isLiked: true });
  });

  it('does not duplicate an existing reply like', async () => {
    prisma.reply.findFirst.mockResolvedValue({ id: replyId, likeCount: 5, deletedAt: null });
    prisma.replyReaction.findUnique.mockResolvedValue({ id: 'reply-reaction-id' });

    const result = await service.likeReply(userId, replyId);

    expect(prisma.replyReaction.create).not.toHaveBeenCalled();
    expect(result).toEqual({ replyId, likeCount: 5, isLiked: true });
  });

  it('returns a valid unlike response when the reply was not liked', async () => {
    prisma.reply.findFirst.mockResolvedValue({ id: replyId, likeCount: 4, deletedAt: null });
    prisma.replyReaction.findUnique.mockResolvedValue(null);

    const result = await service.unlikeReply(userId, replyId);

    expect(prisma.replyReaction.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ replyId, likeCount: 4, isLiked: false });
  });

  it('rejects likes for missing or deleted replies', async () => {
    prisma.reply.findFirst.mockResolvedValue(null);

    await expect(service.likeReply(userId, replyId)).rejects.toThrow(NotFoundException);
  });
});
