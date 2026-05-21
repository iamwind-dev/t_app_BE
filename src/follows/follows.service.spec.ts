import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { FollowsService } from './follows.service';

type MockUser = {
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
};

type MockPrismaService = {
  user: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  follow: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('FollowsService', () => {
  let service: FollowsService;
  let prisma: MockPrismaService;
  let notificationsService: { createFollowNotification: jest.Mock };

  const user: MockUser = {
    id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
    username: 'user_name',
    displayName: 'User Name',
    bio: 'Building mobile apps.',
    avatarUrl: null,
    followerCount: 24,
    followingCount: 18,
    postCount: 12,
    status: 'active',
    deletedAt: null,
    createdAt: new Date('2026-04-24T14:00:00.000Z'),
    updatedAt: new Date('2026-04-24T14:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      follow: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback({
            follow: prisma.follow,
            user: prisma.user,
          });
        }

        return callback;
      }),
    };
    notificationsService = {
      createFollowNotification: jest.fn(),
    };

    service = new FollowsService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('follows another active user and increments counters', async () => {
    const targetUser = {
      ...user,
      id: '2b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      username: 'target_user',
      followerCount: 2,
    };
    const updatedTargetUser = { ...targetUser, followerCount: 3 };
    prisma.user.findFirst.mockResolvedValueOnce(targetUser).mockResolvedValueOnce(updatedTargetUser);
    prisma.follow.create.mockResolvedValue({ id: 'follow-id' });
    prisma.follow.updateMany.mockResolvedValue({ count: 0 });
    prisma.user.update.mockResolvedValue(user);
    prisma.follow.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'follow-id',
        followerId: user.id,
        followingId: targetUser.id,
        deletedAt: null,
      });

    const result = await service.followUser(user.id, targetUser.id);

    expect(prisma.follow.create).toHaveBeenCalledWith({
      data: {
        followerId: user.id,
        followingId: targetUser.id,
      },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { followingCount: { increment: 1 } },
    });
    expect(notificationsService.createFollowNotification).toHaveBeenCalledWith({
      actorId: user.id,
      recipientId: targetUser.id,
      followId: 'follow-id',
    });
    expect(result.followersCount).toBe(3);
    expect(result.isFollowing).toBe(true);
  });

  it('unfollows another user and decrements counters', async () => {
    const targetUser = {
      ...user,
      id: '2b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      username: 'target_user',
      followerCount: 3,
    };
    const updatedTargetUser = { ...targetUser, followerCount: 2 };
    prisma.user.findFirst.mockResolvedValueOnce(targetUser).mockResolvedValueOnce(updatedTargetUser);
    prisma.follow.findFirst
      .mockResolvedValueOnce({
        id: 'follow-id',
        followerId: user.id,
        followingId: targetUser.id,
        deletedAt: null,
      })
      .mockResolvedValueOnce(null);
    prisma.follow.update.mockResolvedValue({
      id: 'follow-id',
      followerId: user.id,
      followingId: targetUser.id,
      deletedAt: new Date(),
    });
    prisma.user.update.mockResolvedValue(user);

    const result = await service.unfollowUser(user.id, targetUser.id);

    expect(prisma.follow.update).toHaveBeenCalledWith({
      where: { id: 'follow-id' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(result.followersCount).toBe(2);
    expect(result.isFollowing).toBe(false);
  });

  it('rejects following yourself', async () => {
    await expect(service.followUser(user.id, user.id)).rejects.toThrow(BadRequestException);
  });

  it('creates a new follow notification source id when re-following a previously unfollowed user', async () => {
    const targetUser = {
      ...user,
      id: '2b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      username: 'target_user',
      followerCount: 2,
    };
    const updatedTargetUser = { ...targetUser, followerCount: 3 };
    prisma.user.findFirst.mockResolvedValueOnce(targetUser).mockResolvedValueOnce(updatedTargetUser);
    prisma.follow.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue(user);
    prisma.follow.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'existing-follow-id',
        deletedAt: new Date('2026-04-24T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'existing-follow-id',
        followerId: user.id,
        followingId: targetUser.id,
        deletedAt: null,
      });

    await service.followUser(user.id, targetUser.id);

    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(notificationsService.createFollowNotification).toHaveBeenCalledWith({
      actorId: user.id,
      recipientId: targetUser.id,
      followId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
    });
    expect(notificationsService.createFollowNotification).not.toHaveBeenCalledWith({
      actorId: user.id,
      recipientId: targetUser.id,
      followId: 'existing-follow-id',
    });
  });

  it('lists followers with cursor pagination and optional isFollowing context', async () => {
    const targetUserId = '2b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
    const followCreatedAt = new Date('2026-04-24T18:00:00.000Z');
    prisma.user.findFirst.mockResolvedValue(user);

    prisma.follow.findMany
      .mockResolvedValueOnce([
        {
          id: 'follow-1',
          followerId: 'follower-1',
          followingId: targetUserId,
          deletedAt: null,
          createdAt: followCreatedAt,
          follower: {
            id: 'follower-1',
            username: 'follower_user',
            displayName: 'Follower User',
            bio: null,
            avatarUrl: null,
            followerCount: 12,
            followingCount: 22,
          },
        },
      ])
      .mockResolvedValueOnce([{ followingId: 'follower-1' }]);

    const result = await service.getFollowers(targetUserId, { limit: 20 }, 'viewer-id');

    expect(prisma.follow.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        followingId: targetUserId,
        deletedAt: null,
        follower: {
          deletedAt: null,
          status: 'active',
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      cursor: undefined,
      skip: undefined,
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
    });
    expect(result.items[0]).toEqual({
      id: 'follower-1',
      username: 'follower_user',
      displayName: 'Follower User',
      avatarUrl: null,
      bio: null,
      followersCount: 12,
      followingCount: 22,
      isFollowing: true,
      followedAt: followCreatedAt,
    });
  });

  it('lists following users with cursor pagination', async () => {
    const targetUserId = '2b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
    const followCreatedAt = new Date('2026-04-24T18:00:00.000Z');
    prisma.user.findFirst.mockResolvedValue(user);

    prisma.follow.findMany.mockResolvedValueOnce([
      {
        id: 'follow-1',
        followerId: targetUserId,
        followingId: 'following-1',
        deletedAt: null,
        createdAt: followCreatedAt,
        following: {
          id: 'following-1',
          username: 'following_user',
          displayName: 'Following User',
          bio: 'hello',
          avatarUrl: null,
          followerCount: 1,
          followingCount: 2,
        },
      },
    ]);

    const result = await service.getFollowing(targetUserId, { limit: 20 }, undefined);

    expect(result.items[0]?.isFollowing).toBe(false);
    expect(result.items[0]?.followedAt).toBe(followCreatedAt);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });
});
