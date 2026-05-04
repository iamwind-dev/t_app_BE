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

interface PostRecord {
  id: string;
  authorId: string;
  content: string | null;
  mediaUrls: string[];
  likeCount: number;
  replyCount: number;
  moderationStatus: string;
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

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(userId: string, dto: CreatePostDto): Promise<PostResponse> {
    const content = this.normalizeContent(dto.content);
    const mediaUrls = dto.mediaUrls ?? [];

    this.assertPostHasContentOrMedia(content, mediaUrls);

    const post = (await this.prisma.post.create({
      data: {
        authorId: userId,
        content,
        mediaUrls,
        moderationStatus: 'APPROVED',
      },
      include: this.postInclude(userId),
    })) as PostRecord;

    return {
      post: this.toPostResponseItem(post),
    };
  }

  async getFeed(userId: string, query: FeedQueryDto): Promise<FeedResponse> {
    const limit = query.limit ?? 20;
    const posts = (await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        moderationStatus: {
          not: 'REJECTED',
        },
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
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt },
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
