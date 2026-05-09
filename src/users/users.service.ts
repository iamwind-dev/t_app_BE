import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserFollowsQueryDto } from './dto/user-follows-query.dto';
import { UserPostsQueryDto } from './dto/user-posts-query.dto';
import { FollowListItemProfile, UserFollowsPage } from './types/user-follows.type';
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

interface FollowRecord {
  id: string;
  followerId: string;
  followingId: string;
  deletedAt: Date | null;
  createdAt: Date;
  follower?: Pick<
    UserRecord,
    | 'id'
    | 'username'
    | 'displayName'
    | 'bio'
    | 'avatarUrl'
    | 'followerCount'
    | 'followingCount'
  >;
  following?: Pick<
    UserRecord,
    | 'id'
    | 'username'
    | 'displayName'
    | 'bio'
    | 'avatarUrl'
    | 'followerCount'
    | 'followingCount'
  >;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
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
      const updatedUser = (await this.prisma.user.update({
        where: { id: userId },
        data,
      })) as UserRecord;

      return this.toPublicProfile(updatedUser, userId);
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async followUser(currentUserId: string, targetUserId: string): Promise<PublicUserProfile> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException({
        code: 'FOLLOW_SELF_NOT_ALLOWED',
        message: 'You cannot follow yourself.',
      });
    }

    const targetUser = await this.findActiveUserById(targetUserId);

    const activeFollow = (await this.prisma.follow.findFirst({
      where: {
        followerId: currentUserId,
        followingId: targetUserId,
        deletedAt: null,
      },
    })) as FollowRecord | null;

    if (activeFollow) {
      return this.toPublicProfile(targetUser, currentUserId);
    }

    const existingFollow = (await this.prisma.follow.findFirst({
      where: {
        followerId: currentUserId,
        followingId: targetUserId,
      },
      select: {
        id: true,
        deletedAt: true,
      },
    })) as Pick<FollowRecord, 'id' | 'deletedAt'> | null;

    let followId: string | null = null;
    let activated = false;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (existingFollow?.id) {
          const updateResult = await tx.follow.updateMany({
            where: {
              id: existingFollow.id,
              deletedAt: {
                not: null,
              },
            },
            data: { deletedAt: null },
          });

          if (updateResult.count === 0) {
            return { followId: existingFollow.id, activated: false };
          }

          await tx.user.update({
            where: { id: currentUserId },
            data: { followingCount: { increment: 1 } },
          });

          await tx.user.update({
            where: { id: targetUserId },
            data: { followerCount: { increment: 1 } },
          });

          return { followId: existingFollow.id, activated: true };
        }

        const created = (await tx.follow.create({
          data: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
          select: { id: true },
        })) as { id: string };

        await tx.user.update({
          where: { id: currentUserId },
          data: { followingCount: { increment: 1 } },
        });

        await tx.user.update({
          where: { id: targetUserId },
          data: { followerCount: { increment: 1 } },
        });

        return { followId: created.id, activated: true };
      });

      followId = result.followId;
      activated = result.activated;
    } catch (error) {
      if (!this.isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      followId = null;
      activated = false;
    }

    if (activated && followId) {
      await this.notificationsService.createFollowNotification({
        actorId: currentUserId,
        recipientId: targetUserId,
        followId,
      });
    }

    const updatedTargetUser = await this.findActiveUserById(targetUserId);
    return this.toPublicProfile(updatedTargetUser, currentUserId);
  }

  async unfollowUser(currentUserId: string, targetUserId: string): Promise<PublicUserProfile> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException({
        code: 'FOLLOW_SELF_NOT_ALLOWED',
        message: 'You cannot unfollow yourself.',
      });
    }

    const targetUser = await this.findActiveUserById(targetUserId);
    const activeFollow = (await this.prisma.follow.findFirst({
      where: {
        followerId: currentUserId,
        followingId: targetUserId,
        deletedAt: null,
      },
    })) as FollowRecord | null;

    if (!activeFollow) {
      return this.toPublicProfile(targetUser, currentUserId);
    }

    await this.prisma.$transaction([
      this.prisma.follow.update({
        where: { id: activeFollow.id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: currentUserId },
        data: { followingCount: { decrement: 1 } },
      }),
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { followerCount: { decrement: 1 } },
      }),
    ]);

    const updatedTargetUser = await this.findActiveUserById(targetUserId);
    return this.toPublicProfile(updatedTargetUser, currentUserId);
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

  async getFollowers(
    userId: string,
    query: UserFollowsQueryDto,
    currentUserId?: string,
  ): Promise<UserFollowsPage> {
    await this.ensureActiveUserExists(userId);

    const limit = query.limit ?? 20;
    const follows = (await this.prisma.follow.findMany({
      where: {
        followingId: userId,
        deletedAt: null,
        follower: {
          deletedAt: null,
          status: 'active',
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            followerCount: true,
            followingCount: true,
          },
        },
      },
    })) as FollowRecord[];

    return this.toFollowsPage({
      follows,
      limit,
      currentUserId,
      pickUser: (follow) => follow.follower,
      followedAt: (follow) => follow.createdAt,
    });
  }

  async getFollowing(
    userId: string,
    query: UserFollowsQueryDto,
    currentUserId?: string,
  ): Promise<UserFollowsPage> {
    await this.ensureActiveUserExists(userId);

    const limit = query.limit ?? 20;
    const follows = (await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        deletedAt: null,
        following: {
          deletedAt: null,
          status: 'active',
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: {
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            followerCount: true,
            followingCount: true,
          },
        },
      },
    })) as FollowRecord[];

    return this.toFollowsPage({
      follows,
      limit,
      currentUserId,
      pickUser: (follow) => follow.following,
      followedAt: (follow) => follow.createdAt,
    });
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

  private async findActiveUserById(userId: string): Promise<UserRecord> {
    const user = (await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        status: 'active',
      },
    })) as UserRecord | null;

    if (!user) {
      throw this.userNotFoundException();
    }

    return user;
  }

  private async toFollowsPage(input: {
    follows: FollowRecord[];
    limit: number;
    currentUserId?: string;
    pickUser: (
      follow: FollowRecord,
    ) => NonNullable<FollowRecord['follower']> | NonNullable<FollowRecord['following']> | undefined;
    followedAt: (follow: FollowRecord) => Date;
  }): Promise<UserFollowsPage> {
    const hasNextPage = input.follows.length > input.limit;
    const slice = input.follows.slice(0, input.limit);

    const users = slice
      .map((follow) => input.pickUser(follow))
      .filter(
        (
          user,
        ): user is NonNullable<FollowRecord['follower']> | NonNullable<FollowRecord['following']> =>
          Boolean(user),
      );
    const userIds = users.map((user) => user.id);

    const followingSet =
      input.currentUserId && userIds.length > 0
        ? new Set(
            (
              (await this.prisma.follow.findMany({
                where: {
                  followerId: input.currentUserId,
                  followingId: {
                    in: userIds,
                  },
                  deletedAt: null,
                },
                select: {
                  followingId: true,
                },
              })) as Array<{ followingId: string }>
            ).map((row) => row.followingId),
          )
        : new Set<string>();

    const items = slice
      .map((follow) => {
        const user = input.pickUser(follow);
        if (!user) {
          return null;
        }

        const item: FollowListItemProfile = {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          followersCount: user.followerCount,
          followingCount: user.followingCount,
          isFollowing: input.currentUserId ? followingSet.has(user.id) : false,
          followedAt: input.followedAt(follow),
        };

        return item;
      })
      .filter((item): item is FollowListItemProfile => item !== null);

    const nextCursor = hasNextPage ? slice[slice.length - 1]?.id ?? null : null;

    return {
      items,
      pageInfo: {
        nextCursor,
        hasNextPage,
      },
    };
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
