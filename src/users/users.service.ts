import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { RealtimeEventsService } from '../domain-events/realtime-events.service';
import { UploadsService } from '../uploads/uploads.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPostsQueryDto } from './dto/user-posts-query.dto';
import { PublicUserProfile, UserPostsPage } from './types/user-profile.type';
import { PrismaService } from '../prisma/prisma.service';

interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  status: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserPostRecord {
  id: string;
  content: string | null;
  mediaUrls: string[];
  likeCount: number;
  replyCount: number;
  moderationStatus: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface UsersTransactionClient {
  user: {
    update(args: unknown): Promise<unknown>;
  };
  domainEventOutbox: {
    create(args: unknown): Promise<unknown>;
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly domainEventsService: DomainEventsService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async getProfileById(id: string, currentUserId?: string): Promise<PublicUserProfile> {
    const user = (await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        status: 'active',
      },
    })) as UserRecord | null;

    if (!user) {
      throw this.userNotFoundException();
    }

    return this.toPublicProfile(user, currentUserId);
  }

  async getProfileByUsername(username: string, currentUserId?: string): Promise<PublicUserProfile> {
    const normalizedUsername = username.trim();
    const user = (await this.prisma.user.findFirst({
      where: {
        username: normalizedUsername,
        deletedAt: null,
        status: 'active',
      },
    })) as UserRecord | null;

    if (!user) {
      throw this.userNotFoundException();
    }

    return this.toPublicProfile(user, currentUserId);
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<PublicUserProfile> {
    const data = this.buildUpdateData(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one profile field is required.',
      });
    }

    const currentUser = (await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        status: 'active',
      },
    })) as UserRecord | null;

    if (!currentUser) {
      throw this.userNotFoundException();
    }

    if (data.username && data.username !== currentUser.username) {
      const existingUsernameOwner = await this.prisma.user.findFirst({
        where: {
          username: data.username,
          deletedAt: null,
        },
      });

      if (existingUsernameOwner) {
        throw new ConflictException({
          code: 'USER_USERNAME_TAKEN',
          message: 'Username is already taken.',
        });
      }
    }

    try {
      const { updatedUser, profileUpdatedEvent } = await this.prisma.$transaction(async (tx) => {
        const client = tx as unknown as UsersTransactionClient;
        const nextUser = (await client.user.update({
          where: { id: userId },
          data,
        })) as UserRecord;

        const event = await this.domainEventsService.createEvent(
          {
            type: 'user.profile.updated',
            actorId: userId,
            subjectType: 'USER',
            subjectId: userId,
            rooms: [`user:${userId}`, 'feed:global'],
            payload: {
              userId: nextUser.id,
              displayName: nextUser.displayName,
              avatarUrl: nextUser.avatarUrl,
              bio: nextUser.bio,
              updatedAt: nextUser.updatedAt.toISOString(),
              version: nextUser.updatedAt.toISOString(),
            },
          },
          client,
        );

        return {
          updatedUser: nextUser,
          profileUpdatedEvent: event,
        };
      });

      if (data.avatarUrl !== undefined) {
        if (data.avatarUrl) {
          await this.uploadsService.syncAttachedUploads({
            ownerId: userId,
            secureUrls: [data.avatarUrl],
            expectedType: 'profile_avatar',
            attachedToType: 'profile_avatar',
            attachedToId: userId,
          });
        } else {
          await this.uploadsService.markResourceUploadsOrphaned({
            ownerId: userId,
            attachedToType: 'profile_avatar',
            attachedToId: userId,
          });
        }
      }

      try {
        this.realtimeEventsService.publish(profileUpdatedEvent);
        await this.domainEventsService.markPublished(profileUpdatedEvent.eventId);
      } catch {
        // Keep the profile update successful even when realtime delivery tracking fails.
      }

      return this.toPublicProfile(updatedUser, userId);
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async getUserPosts(userId: string, query: UserPostsQueryDto): Promise<UserPostsPage> {
    await this.ensureActiveUserExists(userId);

    const limit = query.limit ?? 20;
    const posts = (await this.prisma.post.findMany({
      where: {
        authorId: userId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })) as UserPostRecord[];

    const hasNextPage = posts.length > limit;
    const items = posts.slice(0, limit).map((post) => ({
      id: post.id,
      author: post.author,
      content: post.content,
      mediaUrls: post.mediaUrls,
      replyCount: post.replyCount,
      reactionCount: post.likeCount,
      moderationStatus: post.moderationStatus.toLowerCase(),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));

    return {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? (items[items.length - 1]?.id ?? null) : null,
        hasNextPage,
      },
    };
  }

  private async ensureActiveUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        status: 'active',
      },
    });

    if (!user) {
      throw this.userNotFoundException();
    }
  }

  private async toPublicProfile(
    user: UserRecord,
    currentUserId?: string,
  ): Promise<PublicUserProfile> {
    const isFollowing = currentUserId
      ? Boolean(
          await this.prisma.follow.findFirst({
            where: {
              followerId: currentUserId,
              followingId: user.id,
              deletedAt: null,
            },
          }),
        )
      : false;

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      followersCount: user.followerCount,
      followingCount: user.followingCount,
      postCount: user.postCount,
      isFollowing,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private buildUpdateData(dto: UpdateProfileDto): {
    username?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
  } {
    const data: {
      username?: string;
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (dto.username !== undefined) {
      data.username = dto.username.trim();
    }

    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim();
    }

    if (dto.bio !== undefined) {
      data.bio = dto.bio === null ? null : dto.bio.trim();
    }

    if (dto.avatarUrl !== undefined) {
      data.avatarUrl = dto.avatarUrl === null ? null : dto.avatarUrl.trim();
    }

    return data;
  }

  private userNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (!this.isPrismaUniqueConstraintError(error)) {
      return;
    }

    const target = error.meta?.target;
    const targetFields = Array.isArray(target) ? target : [];

    if (targetFields.includes('username')) {
      throw new ConflictException({
        code: 'USER_USERNAME_TAKEN',
        message: 'Username is already taken.',
      });
    }
  }

  private isPrismaUniqueConstraintError(
    error: unknown,
  ): error is { code: 'P2002'; meta?: { target?: unknown } } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
