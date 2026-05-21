import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { RealtimeEventsService } from '../domain-events/realtime-events.service';
import { DomainEventEnvelope } from '../domain-events/types/domain-event.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUserProfile } from '../users/types/user-profile.type';
import { FollowsQueryDto } from './dto/follows-query.dto';
import { FollowListItemProfile, FollowListPage } from './types/follow-response.type';

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

interface TransactionClient {
  follow: {
    updateMany(args: unknown): Promise<{ count: number }>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
  };
  user: {
    update(args: unknown): Promise<unknown>;
  };
  domainEventOutbox: {
    create(args: unknown): Promise<unknown>;
  };
}

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly domainEventsService?: DomainEventsService,
    private readonly realtimeEventsService?: RealtimeEventsService,
  ) {}

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

    let notificationSourceId: string | null = null;
    let activated = false;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const client = tx as unknown as TransactionClient;
        if (existingFollow?.id) {
          const updateResult = await client.follow.updateMany({
            where: {
              id: existingFollow.id,
              deletedAt: {
                not: null,
              },
            },
            data: { deletedAt: null },
          });

          if (updateResult.count === 0) {
            return { notificationSourceId: existingFollow.id, activated: false };
          }

          await client.user.update({
            where: { id: currentUserId },
            data: { followingCount: { increment: 1 } },
          });

          await client.user.update({
            where: { id: targetUserId },
            data: { followerCount: { increment: 1 } },
          });

          return {
            notificationSourceId: randomUUID(),
            activated: true,
            event: await this.createOutboxEvent(
              {
                type: 'follow.created',
                actorId: currentUserId,
                subjectType: 'FOLLOW',
                subjectId: existingFollow.id,
                rooms: [`user:${targetUserId}`, `user:${currentUserId}`],
                payload: {
                  followerId: currentUserId,
                  followingId: targetUserId,
                },
              },
              client,
            ),
          };
        }

        const created = (await client.follow.create({
          data: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
          select: { id: true },
        })) as { id: string };

        await client.user.update({
          where: { id: currentUserId },
          data: { followingCount: { increment: 1 } },
        });

        await client.user.update({
          where: { id: targetUserId },
          data: { followerCount: { increment: 1 } },
        });

        return {
          notificationSourceId: created.id,
          activated: true,
          event: await this.createOutboxEvent(
            {
              type: 'follow.created',
              actorId: currentUserId,
              subjectType: 'FOLLOW',
              subjectId: created.id,
              rooms: [`user:${targetUserId}`, `user:${currentUserId}`],
              payload: {
                followerId: currentUserId,
                followingId: targetUserId,
              },
            },
            client,
          ),
        };
      });

      notificationSourceId = result.notificationSourceId;
      activated = result.activated;
      await this.publishEvent(result.event ?? null);
    } catch (error) {
      if (!this.isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      notificationSourceId = null;
      activated = false;
    }

    if (activated && notificationSourceId) {
      await this.notificationsService.createFollowNotification({
        actorId: currentUserId,
        recipientId: targetUserId,
        followId: notificationSourceId,
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

    const event = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      await client.follow.update({
        where: { id: activeFollow.id },
        data: { deletedAt: new Date() },
      });
      await client.user.update({
        where: { id: currentUserId },
        data: { followingCount: { decrement: 1 } },
      });
      await client.user.update({
        where: { id: targetUserId },
        data: { followerCount: { decrement: 1 } },
      });

      return this.createOutboxEvent(
        {
          type: 'follow.deleted',
          actorId: currentUserId,
          subjectType: 'FOLLOW',
          subjectId: activeFollow.id,
          rooms: [`user:${targetUserId}`, `user:${currentUserId}`],
          payload: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
        },
        client,
      );
    });
    await this.publishEvent(event);

    const updatedTargetUser = await this.findActiveUserById(targetUserId);
    return this.toPublicProfile(updatedTargetUser, currentUserId);
  }

  async getFollowers(
    userId: string,
    query: FollowsQueryDto,
    currentUserId?: string,
  ): Promise<FollowListPage> {
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
    query: FollowsQueryDto,
    currentUserId?: string,
  ): Promise<FollowListPage> {
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
  }): Promise<FollowListPage> {
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

  private userNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
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
