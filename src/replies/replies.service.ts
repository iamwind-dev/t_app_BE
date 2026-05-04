import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReplyDto } from './dto/create-reply.dto';
import { ReplyQueryDto } from './dto/reply-query.dto';
import { ReplyListResponse, ReplyResponse, ReplyResponseItem } from './types/reply-response.type';

interface ContentAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface PostTarget {
  id: string;
  authorId: string;
}

interface ParentReplyTarget {
  id: string;
  postId: string;
  authorId: string;
}

interface ReplyRecord {
  id: string;
  postId: string;
  parentReplyId: string | null;
  authorId: string;
  content: string | null;
  mediaUrls: string[];
  likeCount: number;
  childReplyCount: number;
  moderationStatus: string;
  createdAt: Date;
  author: ContentAuthor;
  reactions?: Array<{ id: string }>;
}

interface TransactionClient {
  reply: {
    create(args: unknown): Promise<ReplyRecord>;
    update(args: unknown): Promise<{ childReplyCount: number }>;
  };
  post: {
    update(args: unknown): Promise<{ replyCount: number }>;
  };
}

@Injectable()
export class RepliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createPostReply(
    currentUserId: string,
    postId: string,
    dto: CreateReplyDto,
  ): Promise<ReplyResponse> {
    this.assertDtoHasContentOrMedia(dto);
    const post = await this.findActivePost(postId);
    const reply = await this.createReply({
      currentUserId,
      postId,
      parentReplyId: null,
      targetAuthorId: post.authorId,
      notificationTargetType: 'POST',
      notificationTargetId: postId,
      dto,
    });

    return { reply };
  }

  async createChildReply(
    currentUserId: string,
    parentReplyId: string,
    dto: CreateReplyDto,
  ): Promise<ReplyResponse> {
    this.assertDtoHasContentOrMedia(dto);
    const parentReply = await this.findActiveReply(parentReplyId);
    const reply = await this.createReply({
      currentUserId,
      postId: parentReply.postId,
      parentReplyId,
      targetAuthorId: parentReply.authorId,
      notificationTargetType: 'REPLY',
      notificationTargetId: parentReplyId,
      dto,
    });

    return { reply };
  }

  async listPostReplies(
    currentUserId: string | undefined,
    postId: string,
    query: ReplyQueryDto,
  ): Promise<ReplyListResponse> {
    await this.findActivePost(postId);
    return this.listReplies({
      currentUserId,
      where: {
        postId,
        parentReplyId: null,
        deletedAt: null,
        moderationStatus: {
          not: 'REJECTED',
        },
      },
      query,
    });
  }

  async listChildReplies(
    currentUserId: string | undefined,
    parentReplyId: string,
    query: ReplyQueryDto,
  ): Promise<ReplyListResponse> {
    await this.findActiveReply(parentReplyId);
    return this.listReplies({
      currentUserId,
      where: {
        parentReplyId,
        deletedAt: null,
        moderationStatus: {
          not: 'REJECTED',
        },
      },
      query,
    });
  }

  private async createReply(input: {
    currentUserId: string;
    postId: string;
    parentReplyId: string | null;
    targetAuthorId: string;
    notificationTargetType: 'POST' | 'REPLY';
    notificationTargetId: string;
    dto: CreateReplyDto;
  }): Promise<ReplyResponseItem> {
    const content = this.normalizeContent(input.dto.content);
    const mediaUrls = input.dto.mediaUrls ?? [];
    this.assertReplyHasContentOrMedia(content, mediaUrls);

    const reply = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      const createdReply = await client.reply.create({
        data: {
          postId: input.postId,
          ...(input.parentReplyId ? { parentReplyId: input.parentReplyId } : {}),
          authorId: input.currentUserId,
          content,
          mediaUrls,
          moderationStatus: 'APPROVED',
        },
        include: this.replyInclude(input.currentUserId),
      });

      await client.post.update({
        where: { id: input.postId },
        data: { replyCount: { increment: 1 } },
        select: { replyCount: true },
      });

      if (input.parentReplyId) {
        await client.reply.update({
          where: { id: input.parentReplyId },
          data: { childReplyCount: { increment: 1 } },
          select: { childReplyCount: true },
        });
      }

      return createdReply;
    });

    await this.notificationsService.createReplyNotification({
      actorId: input.currentUserId,
      recipientId: input.targetAuthorId,
      targetType: input.notificationTargetType,
      targetId: input.notificationTargetId,
      replyId: reply.id,
    });

    return this.toReplyResponseItem(reply);
  }

  private async listReplies(input: {
    currentUserId: string | undefined;
    where: Record<string, unknown>;
    query: ReplyQueryDto;
  }): Promise<ReplyListResponse> {
    const limit = input.query.limit ?? 20;
    const replies = (await this.prisma.reply.findMany({
      where: input.where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      cursor: input.query.cursor ? { id: input.query.cursor } : undefined,
      skip: input.query.cursor ? 1 : undefined,
      include: this.replyInclude(input.currentUserId),
    })) as ReplyRecord[];

    const hasNextPage = replies.length > limit;
    const items = replies.slice(0, limit).map((reply) => this.toReplyResponseItem(reply));

    return {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null,
        hasNextPage,
      },
    };
  }

  private async findActivePost(postId: string): Promise<PostTarget> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, authorId: true },
    });

    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post was not found.',
      });
    }

    return post;
  }

  private async findActiveReply(replyId: string): Promise<ParentReplyTarget> {
    const reply = await this.prisma.reply.findFirst({
      where: { id: replyId, deletedAt: null },
      select: { id: true, postId: true, authorId: true },
    });

    if (!reply) {
      throw new NotFoundException({
        code: 'REPLY_NOT_FOUND',
        message: 'Reply was not found.',
      });
    }

    return reply;
  }

  private normalizeContent(content: string | undefined): string | null {
    const normalizedContent = content?.trim();
    return normalizedContent && normalizedContent.length > 0 ? normalizedContent : null;
  }

  private assertDtoHasContentOrMedia(dto: CreateReplyDto): void {
    this.assertReplyHasContentOrMedia(this.normalizeContent(dto.content), dto.mediaUrls ?? []);
  }

  private assertReplyHasContentOrMedia(content: string | null, mediaUrls: string[]): void {
    if (!content && mediaUrls.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Reply must include content or media.',
      });
    }
  }

  private toReplyResponseItem(reply: ReplyRecord): ReplyResponseItem {
    return {
      id: reply.id,
      postId: reply.postId,
      parentReplyId: reply.parentReplyId,
      author: reply.author,
      content: reply.content,
      mediaUrls: reply.mediaUrls,
      likeCount: reply.likeCount,
      childReplyCount: reply.childReplyCount,
      moderationStatus: reply.moderationStatus.toLowerCase(),
      createdAt: reply.createdAt,
      isLikedByMe: (reply.reactions ?? []).length > 0,
    };
  }

  private replyInclude(currentUserId: string | undefined): {
    author: {
      select: {
        id: true;
        username: true;
        displayName: true;
        avatarUrl: true;
      };
    };
    reactions: {
      where: {
        userId: string;
        type: 'LIKE';
      };
      select: {
        id: true;
      };
    };
  } {
    return {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      reactions: {
        where: {
          userId: currentUserId ?? '',
          type: 'LIKE',
        },
        select: {
          id: true,
        },
      },
    };
  }
}
