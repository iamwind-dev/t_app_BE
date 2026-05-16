import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  DeletePostResponse,
  FeedResponse,
  PostResponse,
  PostResponseItem,
} from './types/post-response.type';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { ModerationService } from '../modules/moderation/moderation.service';

interface PostRecord {
  id: string;
  authorId: string;
  content: string | null;
  mediaUrls: string[];
  likeCount: number;
  replyCount: number;
  moderationStatus: string;
  visibilityLevel: string;
  toxicityScore: number | null;
  moderationCategories: string[];
  moderationMessage: string | null;
  moderationHighlights: unknown;
  moderationSuggestion: string | null;
  moderationModel: string | null;
  aiReviewedAt: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  reactions?: Array<{ id: string }>;
}

interface PostUpdateData {
  content?: string | null;
  mediaUrls?: string[];
}

interface TransactionClient {
  post: {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<unknown>;
  };
  user: {
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly moderationService: ModerationService,
  ) {}

  async createPost(userId: string, dto: CreatePostDto): Promise<PostResponse> {
    const content = this.normalizeContent(dto.content);
    const mediaUrls = dto.mediaUrls ?? [];

    this.assertPostHasContentOrMedia(content, mediaUrls);
    const moderation = await this.moderationService.moderateText(content ?? '');
    const visibilityLevel = this.moderationService.toVisibilityLevel(moderation.label);
    const aiReviewedAt = new Date();

    const post = (await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;

      const createdPost = await client.post.create({
        data: {
          authorId: userId,
          content,
          mediaUrls,
          moderationStatus: moderation.label,
          toxicityScore: moderation.toxicityScore,
          moderationCategories: moderation.categories,
          moderationMessage: moderation.message,
          moderationHighlights: moderation.highlights,
          moderationSuggestion: moderation.suggestion,
          moderationModel: moderation.model,
          visibilityLevel,
          aiReviewedAt,
        },
        include: this.postInclude(userId),
      });

      await client.user.update({
        where: { id: userId },
        data: {
          postCount: {
            increment: 1,
          },
        },
      });

      return createdPost;
    })) as PostRecord;

    await this.uploadsService.syncAttachedUploads({
      ownerId: userId,
      secureUrls: mediaUrls,
      expectedType: 'post',
      attachedToType: 'post',
      attachedToId: post.id,
    });

    return {
      post: this.toPostResponseItem(post),
      moderation: {
        label: moderation.label,
        toxicityScore: moderation.toxicityScore,
        categories: moderation.categories,
        message: moderation.message,
        highlights: moderation.highlights,
        suggestion: moderation.suggestion,
        model: moderation.model,
        visibilityLevel,
      },
    };
  }

  async getFeed(userId: string, query: FeedQueryDto): Promise<FeedResponse> {
    const limit = query.limit ?? 20;
    const posts = (await this.prisma.post.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: this.postInclude(userId),
    })) as PostRecord[];

    const hasNextPage = posts.length > limit;
    const items = posts.slice(0, limit).map((post) => this.toPostResponseItem(post));

    return {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null,
        hasNextPage,
      },
    };
  }

  async getPostById(userId: string, postId: string): Promise<PostResponse> {
    const post = await this.findActivePostById(postId, userId);

    return {
      post: this.toPostResponseItem(post),
    };
  }

  async updatePost(userId: string, postId: string, dto: UpdatePostDto): Promise<PostResponse> {
    const existingPost = await this.findActivePostById(postId, userId);

    if (existingPost.authorId !== userId) {
      throw new ForbiddenException({
        code: 'POST_FORBIDDEN',
        message: 'You are not allowed to modify this post.',
      });
    }

    const data = this.buildUpdateData(dto);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No valid fields were provided for update.',
      });
    }

    const finalContent = data.content !== undefined ? data.content : existingPost.content;
    const finalMediaUrls = data.mediaUrls !== undefined ? data.mediaUrls : existingPost.mediaUrls;
    this.assertPostHasContentOrMedia(finalContent, finalMediaUrls);

    const updatedPost = (await this.prisma.post.update({
      where: { id: postId },
      data,
      include: this.postInclude(userId),
    })) as PostRecord;

    if (data.mediaUrls !== undefined) {
      await this.uploadsService.syncAttachedUploads({
        ownerId: userId,
        secureUrls: updatedPost.mediaUrls,
        expectedType: 'post',
        attachedToType: 'post',
        attachedToId: postId,
      });
    }

    return {
      post: this.toPostResponseItem(updatedPost),
    };
  }

  async deletePost(userId: string, postId: string): Promise<DeletePostResponse> {
    const existingPost = await this.findActivePostById(postId, userId);

    if (existingPost.authorId !== userId) {
      throw new ForbiddenException({
        code: 'POST_FORBIDDEN',
        message: 'You are not allowed to modify this post.',
      });
    }

    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;

      await client.post.update({
        where: { id: postId },
        data: { deletedAt },
      });

      await client.user.updateMany({
        where: {
          id: userId,
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
    });

    await this.uploadsService.markResourceUploadsOrphaned({
      ownerId: userId,
      attachedToType: 'post',
      attachedToId: postId,
    });

    return {
      deleted: true,
      id: postId,
      deletedAt,
    };
  }

  private async findActivePostById(postId: string, currentUserId: string): Promise<PostRecord> {
    const post = (await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
      include: this.postInclude(currentUserId),
    })) as PostRecord | null;

    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post was not found.',
      });
    }

    return post;
  }

  private buildUpdateData(dto: UpdatePostDto): PostUpdateData {
    const data: PostUpdateData = {};

    if (dto.content !== undefined) {
      data.content = this.normalizeContent(dto.content ?? undefined);
    }

    if (dto.mediaUrls !== undefined) {
      data.mediaUrls = dto.mediaUrls;
    }

    return data;
  }

  private normalizeContent(content: string | undefined): string | null {
    const normalizedContent = content?.trim();
    return normalizedContent && normalizedContent.length > 0 ? normalizedContent : null;
  }

  private assertPostHasContentOrMedia(content: string | null, mediaUrls: string[]): void {
    if (!content && mediaUrls.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Post must include content or media.',
      });
    }
  }

  private toPostResponseItem(post: PostRecord): PostResponseItem {
    return {
      id: post.id,
      content: post.content,
      mediaUrls: post.mediaUrls,
      moderationStatus: post.moderationStatus.toLowerCase(),
      visibilityLevel: post.visibilityLevel.toLowerCase(),
      toxicityScore: post.toxicityScore,
      moderationCategories: post.moderationCategories,
      moderationMessage: post.moderationMessage,
      moderationHighlights: post.moderationHighlights,
      moderationSuggestion: post.moderationSuggestion,
      moderationModel: post.moderationModel,
      aiReviewedAt: post.aiReviewedAt,
      createdAt: post.createdAt,
      author: post.author,
      likeCount: post.likeCount,
      replyCount: post.replyCount,
      isLikedByMe: (post.reactions ?? []).length > 0,
    };
  }

  private postInclude(currentUserId: string): {
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
}
