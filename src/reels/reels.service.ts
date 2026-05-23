import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { RealtimeEventsService } from '../domain-events/realtime-events.service';
import { DomainEventEnvelope } from '../domain-events/types/domain-event.type';
import { ModerationResult } from '../modules/moderation/interfaces/moderation-result.interface';
import { ModerationService } from '../modules/moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateReelCommentDto } from './dto/create-reel-comment.dto';
import { CreateReelDto } from './dto/create-reel.dto';
import { ReelCommentQueryDto } from './dto/reel-comment-query.dto';
import { ReelFeedQueryDto } from './dto/reel-feed-query.dto';
import {
  DeleteReelResponse,
  ReelCommentListResponse,
  ReelCommentResponse,
  ReelCommentResponseItem,
  ReelFeedResponse,
  ReelReactionResponse,
  ReelResponse,
  ReelResponseItem,
} from './types/reel-response.type';

interface ReelRecord {
  id: string;
  authorId: string;
  content: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  audioTitle: string | null;
  durationSeconds: number | null;
  viewCount: number;
  likeCount: number;
  replyCount: number;
  moderationStatus: string;
  moderationLabel: string | null;
  moderationConfidence: number | null;
  moderationAction: string | null;
  moderationIsWarning: boolean;
  visibilityLevel: string;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  reactions?: Array<{ id: string }>;
}

interface ReelCommentRecord {
  id: string;
  postId: string;
  authorId: string;
  content: string | null;
  likeCount: number;
  moderationStatus: string;
  moderationLabel: string | null;
  moderationConfidence: number | null;
  moderationAction: string | null;
  moderationIsWarning: boolean;
  moderationModel: string | null;
  aiReviewedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  reactions?: Array<{ id: string }>;
}

interface TransactionClient {
  postReaction: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
    delete(args: unknown): Promise<unknown>;
  };
  post: {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
    findUnique(args: unknown): Promise<{ likeCount: number } | null>;
  };
  reply: {
    create(args: unknown): Promise<ReelCommentRecord>;
    findMany(args: unknown): Promise<ReelCommentRecord[]>;
  };
  user: {
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  domainEventOutbox: {
    create(args: unknown): Promise<unknown>;
  };
}

@Injectable()
export class ReelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly moderationService: ModerationService,
    private readonly notificationsService: NotificationsService,
    private readonly domainEventsService?: DomainEventsService,
    private readonly realtimeEventsService?: RealtimeEventsService,
  ) {}

  async createReel(currentUserId: string, dto: CreateReelDto): Promise<ReelResponse> {
    const caption = this.normalizeText(dto.caption);
    const videoUrl = dto.videoUrl.trim();
    const thumbnailUrl = this.normalizeText(dto.thumbnailUrl);
    const audioTitle = this.normalizeText(dto.audioTitle);

    if (!videoUrl) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Reel video is required.',
      });
    }

    const moderation = await this.moderationService.moderateText(caption ?? '');
    const visibilityLevel = this.moderationService.toVisibilityLevel(moderation.status);
    const aiReviewedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      const createdReel = (await client.post.create({
        data: {
          authorId: currentUserId,
          type: 'REEL',
          content: caption,
          mediaUrls: [videoUrl],
          videoUrl,
          thumbnailUrl,
          audioTitle,
          durationSeconds: dto.durationSeconds ?? null,
          moderationStatus: moderation.status,
          moderationScore: moderation.final_confidence,
          moderationReason: moderation.final_label,
          toxicityScore: moderation.final_confidence,
          moderationCategories: this.toModerationCategories(moderation),
          moderationMessage: moderation.action,
          moderationHighlights: [],
          moderationSuggestion: null,
          moderationModel: moderation.model,
          moderationLabel: moderation.final_label,
          moderationConfidence: moderation.final_confidence,
          moderationAction: moderation.action,
          moderationIsWarning: moderation.is_warning,
          moderationRaw: moderation,
          visibilityLevel,
          aiReviewedAt,
        },
        include: this.reelInclude(currentUserId),
      })) as ReelRecord;

      await client.user.update({
        where: { id: currentUserId },
        data: {
          postCount: {
            increment: 1,
          },
        },
      });

      const event = await this.createOutboxEvent(
        {
          type: 'reel.created',
          actorId: currentUserId,
          subjectType: 'REEL',
          subjectId: createdReel.id,
          rooms: ['reels:global', `user:${currentUserId}`, `thread:${createdReel.id}`],
          payload: {
            reel: this.toReelResponseItem(createdReel),
          },
        },
        client,
      );

      return { reel: createdReel, event };
    });

    await this.uploadsService.syncAttachedUploads({
      ownerId: currentUserId,
      secureUrls: [videoUrl],
      expectedType: 'post',
      attachedToType: 'post',
      attachedToId: result.reel.id,
    });

    await this.publishEvent(result.event);

    return {
      reel: this.toReelResponseItem(result.reel),
      moderation,
    };
  }

  async getFeed(currentUserId: string, query: ReelFeedQueryDto): Promise<ReelFeedResponse> {
    const limit = query.limit ?? 20;
    const reels = (await this.prisma.post.findMany({
      where: {
        type: 'REEL',
        deletedAt: null,
        moderationStatus: {
          not: 'REJECTED',
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: this.reelInclude(currentUserId),
    })) as ReelRecord[];

    const hasNextPage = reels.length > limit;
    const items = reels.slice(0, limit).map((reel) => this.toReelResponseItem(reel));

    return {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null,
        hasNextPage,
      },
    };
  }

  async getReelById(currentUserId: string, reelId: string): Promise<ReelResponse> {
    const reel = await this.findActiveReelById(reelId, currentUserId);

    return {
      reel: this.toReelResponseItem(reel),
    };
  }

  async likeReel(currentUserId: string, reelId: string): Promise<ReelReactionResponse> {
    const reel = await this.findActiveReelById(reelId, currentUserId);

    const result = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      const existingReaction = await client.postReaction.findUnique({
        where: {
          postId_userId_type: {
            postId: reelId,
            userId: currentUserId,
            type: 'LIKE',
          },
        },
      });

      if (existingReaction) {
        return {
          reelId,
          likeCount: reel.likeCount,
          isLiked: true,
        };
      }

      const createdReaction = await client.postReaction.create({
        data: {
          postId: reelId,
          userId: currentUserId,
          type: 'LIKE',
        },
      });

      const updatedReel = (await client.post.update({
        where: { id: reelId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      })) as { likeCount: number };

      return {
        reelId,
        likeCount: updatedReel.likeCount,
        isLiked: true,
        notificationSourceId: createdReaction.id,
        event: await this.createOutboxEvent(
          {
            type: 'reel.reaction.created',
            actorId: currentUserId,
            subjectType: 'REEL',
            subjectId: reelId,
            rooms: [`thread:${reelId}`, `user:${currentUserId}`, `user:${reel.authorId}`],
            payload: {
              targetType: 'REEL',
              targetId: reelId,
              likeCount: updatedReel.likeCount,
              isLiked: true,
            },
          },
          client,
        ),
      };
    });

    if (result.notificationSourceId) {
      await this.notificationsService.createLikeNotification({
        actorId: currentUserId,
        recipientId: reel.authorId,
        targetType: 'REEL',
        targetId: reelId,
        sourceType: 'REEL_REACTION',
        sourceId: result.notificationSourceId,
      });
    }

    await this.publishEvent(result.event ?? null);

    return {
      reelId: result.reelId,
      likeCount: result.likeCount,
      isLiked: result.isLiked,
    };
  }

  async unlikeReel(currentUserId: string, reelId: string): Promise<ReelReactionResponse> {
    await this.findActiveReelById(reelId, currentUserId);

    const result = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      const reactionWhere = {
        postId_userId_type: {
          postId: reelId,
          userId: currentUserId,
          type: 'LIKE',
        },
      };

      const existingReaction = await client.postReaction.findUnique({
        where: reactionWhere,
      });

      if (!existingReaction) {
        const current = await client.post.findUnique({
          where: { id: reelId },
          select: { likeCount: true },
        });

        return {
          reelId,
          likeCount: current?.likeCount ?? 0,
          isLiked: false,
        };
      }

      await client.postReaction.delete({
        where: reactionWhere,
      });

      await client.post.updateMany({
        where: {
          id: reelId,
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

      const updatedReel = await client.post.findUnique({
        where: { id: reelId },
        select: { likeCount: true },
      });

      const likeCount = updatedReel?.likeCount ?? 0;

      return {
        reelId,
        likeCount,
        isLiked: false,
        event: await this.createOutboxEvent(
          {
            type: 'reel.reaction.deleted',
            actorId: currentUserId,
            subjectType: 'REEL',
            subjectId: reelId,
            rooms: [`thread:${reelId}`, `user:${currentUserId}`],
            payload: {
              targetType: 'REEL',
              targetId: reelId,
              likeCount,
              isLiked: false,
            },
          },
          client,
        ),
      };
    });

    await this.publishEvent(result.event ?? null);

    return {
      reelId: result.reelId,
      likeCount: result.likeCount,
      isLiked: result.isLiked,
    };
  }

  async listComments(
    currentUserId: string,
    reelId: string,
    query: ReelCommentQueryDto,
  ): Promise<ReelCommentListResponse> {
    await this.findActiveReelById(reelId, currentUserId);

    const limit = query.limit ?? 20;
    const comments = (await this.prisma.reply.findMany({
      where: {
        postId: reelId,
        parentReplyId: null,
        deletedAt: null,
        moderationStatus: {
          not: 'REJECTED',
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: this.commentInclude(currentUserId),
    })) as ReelCommentRecord[];

    const hasNextPage = comments.length > limit;
    const items = comments.slice(0, limit).map((comment) => this.toCommentResponseItem(comment));

    return {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null,
        hasNextPage,
      },
    };
  }

  async createComment(
    currentUserId: string,
    reelId: string,
    dto: CreateReelCommentDto,
  ): Promise<ReelCommentResponse> {
    const reel = await this.findActiveReelById(reelId, currentUserId);
    const content = this.normalizeText(dto.content);

    if (!content) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Comment must not be empty.',
      });
    }

    const moderation = await this.moderationService.moderateText(content);
    const aiReviewedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      const createdComment = await client.reply.create({
        data: {
          postId: reelId,
          authorId: currentUserId,
          content,
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
        include: this.commentInclude(currentUserId),
      });

      await client.post.update({
        where: { id: reelId },
        data: { replyCount: { increment: 1 } },
        select: { replyCount: true },
      });

      const event = await this.createOutboxEvent(
        {
          type: 'reel.comment.created',
          actorId: currentUserId,
          subjectType: 'REEL_COMMENT',
          subjectId: createdComment.id,
          rooms: [`thread:${reelId}`, `user:${currentUserId}`, `user:${reel.authorId}`],
          payload: {
            comment: this.toCommentResponseItem(createdComment),
          },
        },
        client,
      );

      return { comment: createdComment, event };
    });

    if (moderation.status !== 'FLAGGED') {
      await this.notificationsService.createReplyNotification({
        actorId: currentUserId,
        recipientId: reel.authorId,
        targetType: 'REEL',
        targetId: reelId,
        replyId: result.comment.id,
      });
    }

    await this.publishEvent(result.event);

    return {
      comment: this.toCommentResponseItem(result.comment),
      moderation,
    };
  }

  async deleteReel(currentUserId: string, reelId: string): Promise<DeleteReelResponse> {
    const existingReel = await this.findActiveReelById(reelId, currentUserId);

    if (existingReel.authorId !== currentUserId) {
      throw new ForbiddenException({
        code: 'REEL_FORBIDDEN',
        message: 'You are not allowed to modify this reel.',
      });
    }

    const deletedAt = new Date();
    const event = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      await client.post.update({
        where: { id: reelId },
        data: { deletedAt },
      });

      await client.user.updateMany({
        where: {
          id: currentUserId,
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

      return this.createOutboxEvent(
        {
          type: 'reel.deleted',
          actorId: currentUserId,
          subjectType: 'REEL',
          subjectId: reelId,
          rooms: ['reels:global', `user:${currentUserId}`, `thread:${reelId}`],
          payload: {
            id: reelId,
            deletedAt: deletedAt.toISOString(),
          },
        },
        client,
      );
    });

    await this.uploadsService.markResourceUploadsOrphaned({
      ownerId: currentUserId,
      attachedToType: 'post',
      attachedToId: reelId,
    });

    await this.publishEvent(event);

    return {
      deleted: true,
      id: reelId,
      deletedAt,
    };
  }

  private async findActiveReelById(reelId: string, currentUserId: string): Promise<ReelRecord> {
    const reel = (await this.prisma.post.findFirst({
      where: {
        id: reelId,
        type: 'REEL',
        deletedAt: null,
      },
      include: this.reelInclude(currentUserId),
    })) as ReelRecord | null;

    if (!reel) {
      throw new NotFoundException({
        code: 'REEL_NOT_FOUND',
        message: 'Reel was not found.',
      });
    }

    return reel;
  }

  private toReelResponseItem(reel: ReelRecord): ReelResponseItem {
    if (!reel.videoUrl) {
      throw new BadRequestException({
        code: 'REEL_INVALID_STATE',
        message: 'Reel video is missing.',
      });
    }

    return {
      id: reel.id,
      caption: reel.content,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      audioTitle: reel.audioTitle,
      durationSeconds: reel.durationSeconds,
      viewCount: reel.viewCount,
      likeCount: reel.likeCount,
      commentCount: reel.replyCount,
      moderationStatus: reel.moderationStatus.toLowerCase(),
      moderationLabel: reel.moderationLabel,
      moderationConfidence: reel.moderationConfidence,
      moderationAction: reel.moderationAction,
      moderationIsWarning: reel.moderationIsWarning,
      visibilityLevel: reel.visibilityLevel.toLowerCase(),
      createdAt: reel.createdAt,
      author: reel.author,
      isLikedByMe: (reel.reactions ?? []).length > 0,
    };
  }

  private reelInclude(currentUserId: string): {
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
          userId: currentUserId,
          type: 'LIKE',
        },
        select: {
          id: true,
        },
      },
    };
  }

  private commentInclude(currentUserId: string): {
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
          userId: currentUserId,
          type: 'LIKE',
        },
        select: {
          id: true,
        },
      },
    };
  }

  private toCommentResponseItem(comment: ReelCommentRecord): ReelCommentResponseItem {
    if (!comment.content) {
      throw new BadRequestException({
        code: 'REEL_COMMENT_INVALID_STATE',
        message: 'Reel comment content is missing.',
      });
    }

    return {
      id: comment.id,
      reelId: comment.postId,
      author: comment.author,
      content: comment.content,
      likeCount: comment.likeCount,
      moderationStatus: comment.moderationStatus.toLowerCase(),
      moderationLabel: comment.moderationLabel,
      moderationConfidence: comment.moderationConfidence,
      moderationAction: comment.moderationAction,
      moderationIsWarning: comment.moderationIsWarning,
      moderationModel: comment.moderationModel,
      aiReviewedAt: comment.aiReviewedAt,
      createdAt: comment.createdAt,
      isLikedByMe: (comment.reactions ?? []).length > 0,
    };
  }

  private normalizeText(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
  }

  private toModerationCategories(moderation: ModerationResult): string[] {
    return Array.from(
      new Set(
        moderation.layers
          .filter((layer) => layer.is_warning)
          .map((layer) => layer.label),
      ),
    );
  }

  private async createOutboxEvent(
    input: {
      type: string;
      actorId: string;
      subjectType: string;
      subjectId: string;
      rooms: string[];
      payload: unknown;
    },
    tx: TransactionClient,
  ): Promise<DomainEventEnvelope | null> {
    if (!this.domainEventsService) {
      return null;
    }

    return this.domainEventsService.createEvent(input, tx);
  }

  private async publishEvent(event: DomainEventEnvelope | null): Promise<void> {
    if (!event || !this.domainEventsService || !this.realtimeEventsService) {
      return;
    }

    try {
      this.realtimeEventsService.publish(event);
      await this.domainEventsService.markPublished(event.eventId);
    } catch {
      return;
    }
  }
}
