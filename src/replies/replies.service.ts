import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../modules/moderation/moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateReplyDto } from './dto/update-reply.dto';
import { ReplyQueryDto } from './dto/reply-query.dto';
import {
  DeleteReplyResponse,
  ReplyListResponse,
  ReplyResponse,
  ReplyResponseItem,
} from './types/reply-response.type';

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

interface ReplyDeleteTarget extends ParentReplyTarget {
  parentReplyId: string | null;
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
  moderationLabel: string | null;
  moderationConfidence: number | null;
  moderationAction: string | null;
  moderationIsWarning: boolean;
  moderationModel: string | null;
  aiReviewedAt: Date | null;
  createdAt: Date;
  author: ContentAuthor;
  reactions?: Array<{ id: string }>;
}

interface ReplyUpdateData {
  content?: string | null;
  mediaUrls?: string[];
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
    private readonly uploadsService: UploadsService,
    private readonly moderationService: ModerationService,
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

    return reply;
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

    return reply;
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

  async getReplyById(
    currentUserId: string | undefined,
    replyId: string,
  ): Promise<ReplyResponse> {
    const reply = await this.findActiveReplyById(replyId, currentUserId);

    return { reply: this.toReplyResponseItem(reply) };
  }

  async updateReply(
    currentUserId: string,
    replyId: string,
    dto: UpdateReplyDto,
  ): Promise<ReplyResponse> {
    const existingReply = await this.findActiveReplyForUpdate(replyId);
    this.assertReplyOwnership(currentUserId, existingReply.authorId);

    const data = this.buildUpdateData(dto);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No valid fields were provided for update.',
      });
    }

    const finalContent = data.content !== undefined ? data.content : existingReply.content;
    const finalMediaUrls =
      data.mediaUrls !== undefined ? data.mediaUrls : existingReply.mediaUrls;
    this.assertReplyHasContentOrMedia(finalContent, finalMediaUrls);

    const updatedReply = (await this.prisma.reply.update({
      where: { id: replyId },
      data,
      include: this.replyInclude(currentUserId),
    })) as ReplyRecord;

    if (data.mediaUrls !== undefined) {
      await this.uploadsService.syncAttachedUploads({
        ownerId: currentUserId,
        secureUrls: updatedReply.mediaUrls,
        expectedType: 'reply',
        attachedToType: 'reply',
        attachedToId: replyId,
      });
    }

    return { reply: this.toReplyResponseItem(updatedReply) };
  }

  async deleteReply(currentUserId: string, replyId: string): Promise<DeleteReplyResponse> {
    const existingReply = await this.findActiveReplyForDelete(replyId);
    this.assertReplyOwnership(currentUserId, existingReply.authorId);

    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      await client.reply.update({
        where: { id: replyId },
        data: { deletedAt },
        select: { childReplyCount: true },
      });

      await client.post.update({
        where: { id: existingReply.postId },
        data: { replyCount: { decrement: 1 } },
        select: { replyCount: true },
      });

      if (existingReply.parentReplyId) {
        await client.reply.update({
          where: { id: existingReply.parentReplyId },
          data: { childReplyCount: { decrement: 1 } },
          select: { childReplyCount: true },
        });
      }
    });

    await this.uploadsService.markResourceUploadsOrphaned({
      ownerId: currentUserId,
      attachedToType: 'reply',
      attachedToId: replyId,
    });

    return {
      deleted: true,
      id: replyId,
      deletedAt,
    };
  }

  private async createReply(input: {
    currentUserId: string;
    postId: string;
    parentReplyId: string | null;
    targetAuthorId: string;
    notificationTargetType: 'POST' | 'REPLY';
    notificationTargetId: string;
    dto: CreateReplyDto;
  }): Promise<ReplyResponse> {
    const content = this.normalizeContent(input.dto.content);
    const mediaUrls = input.dto.mediaUrls ?? [];
    this.assertReplyHasContentOrMedia(content, mediaUrls);
    const moderation = await this.moderationService.moderateText(content ?? '');
    const aiReviewedAt = new Date();

    const reply = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      const createdReply = await client.reply.create({
        data: {
          postId: input.postId,
          ...(input.parentReplyId ? { parentReplyId: input.parentReplyId } : {}),
          authorId: input.currentUserId,
          content,
          mediaUrls,
          moderationStatus: moderation.status,
          moderationScore: moderation.final_confidence,
          moderationReason: moderation.final_label,
          moderationLabel: moderation.final_label,
          moderationConfidence: moderation.final_confidence,
          moderationAction: moderation.action,
          moderationIsWarning: moderation.is_warning,
          moderationModel: moderation.model,
          moderationRaw: moderation,
          aiReviewedAt,
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

    await this.uploadsService.syncAttachedUploads({
      ownerId: input.currentUserId,
      secureUrls: mediaUrls,
      expectedType: 'reply',
      attachedToType: 'reply',
      attachedToId: reply.id,
    });

    if (moderation.status !== 'FLAGGED') {
      await this.notificationsService.createReplyNotification({
        actorId: input.currentUserId,
        recipientId: input.targetAuthorId,
        targetType: input.notificationTargetType,
        targetId: input.notificationTargetId,
        replyId: reply.id,
      });
    }

    return {
      reply: this.toReplyResponseItem(reply),
      moderation,
    };
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

  private async findActiveReplyById(
    replyId: string,
    currentUserId: string | undefined,
  ): Promise<ReplyRecord> {
    const reply = (await this.prisma.reply.findFirst({
      where: { id: replyId, deletedAt: null },
      include: this.replyInclude(currentUserId),
    })) as ReplyRecord | null;

    if (!reply) {
      throw new NotFoundException({
        code: 'REPLY_NOT_FOUND',
        message: 'Reply was not found.',
      });
    }

    return reply;
  }

  private async findActiveReplyForUpdate(replyId: string): Promise<ReplyRecord> {
    const reply = (await this.prisma.reply.findFirst({
      where: { id: replyId, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        content: true,
        mediaUrls: true,
        postId: true,
        parentReplyId: true,
        likeCount: true,
        childReplyCount: true,
        moderationStatus: true,
        moderationLabel: true,
        moderationConfidence: true,
        moderationAction: true,
        moderationIsWarning: true,
        moderationModel: true,
        aiReviewedAt: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })) as ReplyRecord | null;

    if (!reply) {
      throw new NotFoundException({
        code: 'REPLY_NOT_FOUND',
        message: 'Reply was not found.',
      });
    }

    return reply;
  }

  private async findActiveReplyForDelete(replyId: string): Promise<ReplyDeleteTarget> {
    const reply = await this.prisma.reply.findFirst({
      where: { id: replyId, deletedAt: null },
      select: { id: true, postId: true, parentReplyId: true, authorId: true },
    });

    if (!reply) {
      throw new NotFoundException({
        code: 'REPLY_NOT_FOUND',
        message: 'Reply was not found.',
      });
    }

    return reply as ReplyDeleteTarget;
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

  private assertReplyOwnership(currentUserId: string, authorId: string): void {
    if (currentUserId !== authorId) {
      throw new ForbiddenException({
        code: 'REPLY_FORBIDDEN',
        message: 'You are not allowed to modify this reply.',
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
      moderationLabel: reply.moderationLabel,
      moderationConfidence: reply.moderationConfidence,
      moderationAction: reply.moderationAction,
      moderationIsWarning: reply.moderationIsWarning,
      moderationModel: reply.moderationModel,
      aiReviewedAt: reply.aiReviewedAt,
      createdAt: reply.createdAt,
      isLikedByMe: (reply.reactions ?? []).length > 0,
    };
  }

  private buildUpdateData(dto: UpdateReplyDto): ReplyUpdateData {
    const data: ReplyUpdateData = {};

    if (dto.content !== undefined) {
      data.content = this.normalizeContent(dto.content ?? undefined);
    }

    if (dto.mediaUrls !== undefined) {
      data.mediaUrls = dto.mediaUrls;
    }

    return data;
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
