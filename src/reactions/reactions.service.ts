import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PostReactionResponse, ReplyReactionResponse } from './types/reaction-response.type';

interface ReactionTarget {
  id: string;
  authorId: string;
  likeCount: number;
}

interface TransactionClient {
  postReaction: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
    delete(args: unknown): Promise<unknown>;
  };
  replyReaction: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
    delete(args: unknown): Promise<unknown>;
  };
  post: {
    update(args: unknown): Promise<{ likeCount: number }>;
    updateMany(args: unknown): Promise<{ count: number }>;
    findUnique(args: unknown): Promise<{ likeCount: number } | null>;
  };
  reply: {
    update(args: unknown): Promise<{ likeCount: number }>;
    updateMany(args: unknown): Promise<{ count: number }>;
    findUnique(args: unknown): Promise<{ likeCount: number } | null>;
  };
}

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async likePost(userId: string, postId: string): Promise<PostReactionResponse> {
    const post = await this.findActivePost(postId);

    const result = await this.prisma.$transaction(async (tx) => {
      const client = tx as TransactionClient;
      const existingReaction = await client.postReaction.findUnique({
        where: {
          postId_userId_type: {
            postId,
            userId,
            type: 'LIKE',
          },
        },
      });

      if (existingReaction) {
        return {
          postId,
          likeCount: post.likeCount,
          isLiked: true,
        };
      }

      const createdReaction = await client.postReaction.create({
        data: {
          postId,
          userId,
          type: 'LIKE',
        },
      });

      const updatedPost = await client.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });

      return {
        postId,
        likeCount: updatedPost.likeCount,
        isLiked: true,
        notificationSourceId: createdReaction.id,
      };
    });

    if (result.notificationSourceId) {
      await this.notificationsService.createLikeNotification({
        actorId: userId,
        recipientId: post.authorId,
        targetType: 'POST',
        targetId: postId,
        sourceType: 'POST_REACTION',
        sourceId: result.notificationSourceId,
      });
    }

    return {
      postId: result.postId,
      likeCount: result.likeCount,
      isLiked: result.isLiked,
    };
  }

  async unlikePost(userId: string, postId: string): Promise<PostReactionResponse> {
    await this.findActivePost(postId);

    return this.prisma.$transaction(async (tx) => {
      const client = tx as TransactionClient;
      const reactionWhere = {
        postId_userId_type: {
          postId,
          userId,
          type: 'LIKE',
        },
      };

      const existingReaction = await client.postReaction.findUnique({
        where: reactionWhere,
      });

      if (!existingReaction) {
        const current = await client.post.findUnique({
          where: { id: postId },
          select: { likeCount: true },
        });

        return {
          postId,
          likeCount: current?.likeCount ?? 0,
          isLiked: false,
        };
      }

      await client.postReaction.delete({
        where: reactionWhere,
      });

      await client.post.updateMany({
        where: {
          id: postId,
          likeCount: {
            gt: 0,
          },
        },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      });

      const updatedPost = await client.post.findUnique({
        where: { id: postId },
        select: { likeCount: true },
      });

      return {
        postId,
        likeCount: updatedPost?.likeCount ?? 0,
        isLiked: false,
      };
    });
  }

  async likeReply(userId: string, replyId: string): Promise<ReplyReactionResponse> {
    const reply = await this.findActiveReply(replyId);

    const result = await this.prisma.$transaction(async (tx) => {
      const client = tx as TransactionClient;
      const existingReaction = await client.replyReaction.findUnique({
        where: {
          replyId_userId_type: {
            replyId,
            userId,
            type: 'LIKE',
          },
        },
      });

      if (existingReaction) {
        return {
          replyId,
          likeCount: reply.likeCount,
          isLiked: true,
        };
      }

      const createdReaction = await client.replyReaction.create({
        data: {
          replyId,
          userId,
          type: 'LIKE',
        },
      });

      const updatedReply = await client.reply.update({
        where: { id: replyId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });

      return {
        replyId,
        likeCount: updatedReply.likeCount,
        isLiked: true,
        notificationSourceId: createdReaction.id,
      };
    });

    if (result.notificationSourceId) {
      await this.notificationsService.createLikeNotification({
        actorId: userId,
        recipientId: reply.authorId,
        targetType: 'REPLY',
        targetId: replyId,
        sourceType: 'REPLY_REACTION',
        sourceId: result.notificationSourceId,
      });
    }

    return {
      replyId: result.replyId,
      likeCount: result.likeCount,
      isLiked: result.isLiked,
    };
  }

  async unlikeReply(userId: string, replyId: string): Promise<ReplyReactionResponse> {
    await this.findActiveReply(replyId);

    return this.prisma.$transaction(async (tx) => {
      const client = tx as TransactionClient;
      const reactionWhere = {
        replyId_userId_type: {
          replyId,
          userId,
          type: 'LIKE',
        },
      };

      const existingReaction = await client.replyReaction.findUnique({
        where: reactionWhere,
      });

      if (!existingReaction) {
        const current = await client.reply.findUnique({
          where: { id: replyId },
          select: { likeCount: true },
        });

        return {
          replyId,
          likeCount: current?.likeCount ?? 0,
          isLiked: false,
        };
      }

      await client.replyReaction.delete({
        where: reactionWhere,
      });

      await client.reply.updateMany({
        where: {
          id: replyId,
          likeCount: {
            gt: 0,
          },
        },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      });

      const updatedReply = await client.reply.findUnique({
        where: { id: replyId },
        select: { likeCount: true },
      });

      return {
        replyId,
        likeCount: updatedReply?.likeCount ?? 0,
        isLiked: false,
      };
    });
  }

  private async findActivePost(postId: string): Promise<ReactionTarget> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, authorId: true, likeCount: true },
    });

    if (!post) {
      throw this.targetNotFoundException();
    }

    return post;
  }

  private async findActiveReply(replyId: string): Promise<ReactionTarget> {
    const reply = await this.prisma.reply.findFirst({
      where: { id: replyId, deletedAt: null },
      select: { id: true, authorId: true, likeCount: true },
    });

    if (!reply) {
      throw this.targetNotFoundException();
    }

    return reply;
  }

  private targetNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: 'REACTION_TARGET_NOT_FOUND',
      message: 'Target content was not found.',
    });
  }
}
