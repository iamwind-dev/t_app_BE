import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { RealtimeEventsService } from '../domain-events/realtime-events.service';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

type MockUser = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
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
  post: {
    findMany: jest.Mock;
  };
  domainEventOutbox: {
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrismaService;
  let uploadsService: {
    syncAttachedUploads: jest.Mock;
    markResourceUploadsOrphaned: jest.Mock;
  };
  let domainEventsService: {
    createEvent: jest.Mock;
    markPublished: jest.Mock;
  };
  let realtimeEventsService: {
    publish: jest.Mock;
  };

  const user: MockUser = {
    id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
    email: 'user@example.com',
    username: 'user_name',
    passwordHash: 'hashed-password',
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
      post: {
        findMany: jest.fn(),
      },
      domainEventOutbox: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback({
            follow: prisma.follow,
            user: prisma.user,
            domainEventOutbox: prisma.domainEventOutbox,
          });
        }

        return callback;
      }),
    };

    uploadsService = {
      syncAttachedUploads: jest.fn(),
      markResourceUploadsOrphaned: jest.fn(),
    };
    domainEventsService = {
      createEvent: jest.fn().mockResolvedValue({
        eventId: 'event-id',
        type: 'user.profile.updated',
        occurredAt: new Date().toISOString(),
        actorId: user.id,
        subjectType: 'USER',
        subjectId: user.id,
        rooms: [`user:${user.id}`, 'feed:global'],
        payload: {},
      }),
      markPublished: jest.fn().mockResolvedValue(undefined),
    };
    realtimeEventsService = {
      publish: jest.fn(),
    };

    service = new UsersService(
      prisma as unknown as PrismaService,
      uploadsService as unknown as UploadsService,
      domainEventsService as unknown as DomainEventsService,
      realtimeEventsService as unknown as RealtimeEventsService,
    );
  });

  it('returns a public profile by id without private fields and includes follow state', async () => {
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.follow.findFirst.mockResolvedValue({
      id: 'follow-id',
      followerId: 'viewer-id',
      followingId: user.id,
      deletedAt: null,
    });

    const result = await service.getProfileById(user.id, 'viewer-id');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: user.id,
        deletedAt: null,
        status: 'active',
      },
    });
    expect(result).toEqual({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      followersCount: 24,
      followingCount: 18,
      postCount: 12,
      isFollowing: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('email');
  });

  it('returns a public profile by username after trimming input', async () => {
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.follow.findFirst.mockResolvedValue(null);

    const result = await service.getProfileByUsername(' user_name ', undefined);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        username: 'user_name',
        deletedAt: null,
        status: 'active',
      },
    });
    expect(result.isFollowing).toBe(false);
  });

  it('throws not found for missing or inactive profiles', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getProfileById(user.id)).rejects.toThrow(NotFoundException);
  });

  it('updates only the current user profile and trims string fields', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(user);
    prisma.user.update.mockResolvedValue({
      ...user,
      username: 'new_user',
      displayName: 'New Name',
      bio: 'New bio',
    });

    const result = await service.updateMe(user.id, {
      username: ' new_user ',
      displayName: ' New Name ',
      bio: ' New bio ',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        username: 'new_user',
        displayName: 'New Name',
        bio: 'New bio',
      },
    });
    expect(domainEventsService.createEvent).toHaveBeenCalled();
    expect(realtimeEventsService.publish).toHaveBeenCalled();
    expect(domainEventsService.markPublished).toHaveBeenCalledWith('event-id');
    expect(result.username).toBe('new_user');
    expect(result.displayName).toBe('New Name');
    expect(result.bio).toBe('New bio');
  });

  it('syncs profile avatar upload ownership when avatar changes', async () => {
    const avatarUrl = 'https://cdn.example.com/uploads/avatars/me.jpg';
    prisma.user.findFirst.mockResolvedValueOnce(user);
    prisma.user.update.mockResolvedValue({
      ...user,
      avatarUrl,
    });

    await service.updateMe(user.id, { avatarUrl });

    expect(uploadsService.syncAttachedUploads).toHaveBeenCalledWith({
      ownerId: user.id,
      secureUrls: [avatarUrl],
      expectedType: 'profile_avatar',
      attachedToType: 'profile_avatar',
      attachedToId: user.id,
    });
  });

  it('orphans profile avatar upload when avatar is removed', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ ...user, avatarUrl: 'https://cdn.example.com/old.jpg' });
    prisma.user.update.mockResolvedValue({
      ...user,
      avatarUrl: null,
    });

    await service.updateMe(user.id, { avatarUrl: null });

    expect(uploadsService.markResourceUploadsOrphaned).toHaveBeenCalledWith({
      ownerId: user.id,
      attachedToType: 'profile_avatar',
      attachedToId: user.id,
    });
  });

  it('rejects duplicate username when updating profile', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(user);
    prisma.user.findFirst.mockResolvedValueOnce({ ...user, id: 'other-user-id' });

    await expect(service.updateMe(user.id, { username: 'taken_user' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects empty update body', async () => {
    await expect(service.updateMe(user.id, {})).rejects.toThrow(BadRequestException);
  });

  it('lists non-deleted user posts with stable pagination', async () => {
    const postCreatedAt = new Date('2026-04-24T14:30:00.000Z');
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.post.findMany.mockResolvedValue([
      {
        id: 'post-1',
        authorId: user.id,
        content: 'Hello profile timeline.',
        mediaUrls: [],
        likeCount: 9,
        replyCount: 2,
        moderationStatus: 'APPROVED',
        createdAt: postCreatedAt,
        updatedAt: postCreatedAt,
        author: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      },
    ]);

    const result = await service.getUserPosts(user.id, { limit: 20 });

    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: {
        authorId: user.id,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      cursor: undefined,
      skip: undefined,
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
    });
    expect(result).toEqual({
      items: [
        {
          id: 'post-1',
          author: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          },
          content: 'Hello profile timeline.',
          mediaUrls: [],
          replyCount: 2,
          reactionCount: 9,
          moderationStatus: 'approved',
          createdAt: postCreatedAt,
          updatedAt: postCreatedAt,
        },
      ],
      pageInfo: {
        nextCursor: null,
        hasNextPage: false,
      },
    });
  });

});
