import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type MockPrismaService = {
  user: {
    findFirst: jest.Mock;
  };
  conversation: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  conversationMember: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  message: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('ChatService', () => {
  let service: ChatService;
  let prisma: MockPrismaService;
  let notificationsService: {
    createMessageNotification: jest.Mock;
  };

  const currentUser = {
    id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
    username: 'current_user',
    displayName: 'Current User',
    avatarUrl: null,
  };
  const targetUser = {
    id: '02d50f39-eef6-4edb-85c0-2dd8d020df3a',
    username: 'friend_user',
    displayName: 'Friend User',
    avatarUrl: null,
  };
  const conversationId = '3a50afcb-17a4-4d7c-8f58-c3d280467ba1';
  const firstMessageId = 'd3a5b71a-56a0-41e0-b985-46d6b7f613c2';
  const secondMessageId = '2464b311-c11a-44bd-92d2-93663c8d4ba8';
  const createdAt = new Date('2026-04-24T14:00:00.000Z');
  const updatedAt = new Date('2026-04-24T14:04:00.000Z');
  const lastSeenAt = new Date('2026-04-24T14:03:00.000Z');

  const conversation = {
    id: conversationId,
    type: 'DIRECT',
    members: [
      {
        userId: currentUser.id,
        user: currentUser,
        joinedAt: createdAt,
        lastSeenMessageId: null,
        lastSeenAt,
      },
      {
        userId: targetUser.id,
        user: targetUser,
        joinedAt: createdAt,
        lastSeenMessageId: null,
        lastSeenAt: null,
      },
    ],
    messages: [
      {
        id: firstMessageId,
        conversationId,
        sender: targetUser,
        type: 'TEXT',
        text: 'Hello!',
        createdAt: updatedAt,
        updatedAt,
      },
    ],
    createdAt,
    updatedAt,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
      conversation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: MockPrismaService) => unknown) => callback(prisma)),
    };

    notificationsService = {
      createMessageNotification: jest.fn(),
    };

    service = new ChatService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('returns the existing direct conversation for the same user pair', async () => {
    prisma.user.findFirst.mockResolvedValue(targetUser);
    prisma.conversation.findUnique.mockResolvedValue(conversation);
    prisma.message.count.mockResolvedValue(1);

    const result = await service.createOrGetDirectConversation(currentUser.id, targetUser.id);

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
      where: { directKey: `${targetUser.id}:${currentUser.id}` },
      include: expect.any(Object),
    });
    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(result.conversation).toEqual({
      id: conversationId,
      type: 'direct',
      members: [
        {
          user: currentUser,
          joinedAt: createdAt,
          lastSeenMessageId: null,
          lastSeenAt,
        },
        {
          user: targetUser,
          joinedAt: createdAt,
          lastSeenMessageId: null,
          lastSeenAt: null,
        },
      ],
      lastMessage: {
        id: firstMessageId,
        conversationId,
        sender: targetUser,
        type: 'text',
        content: 'Hello!',
        text: 'Hello!',
        mediaUrl: null,
        deletedAt: null,
        createdAt: updatedAt,
        updatedAt,
      },
      unreadCount: 1,
      createdAt,
      updatedAt,
    });
  });

  it('creates a new direct conversation with exactly two members when none exists', async () => {
    prisma.user.findFirst.mockResolvedValue(targetUser);
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue({ ...conversation, messages: [] });
    prisma.message.count.mockResolvedValue(0);

    const result = await service.createOrGetDirectConversation(currentUser.id, targetUser.id);

    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        type: 'DIRECT',
        directKey: `${targetUser.id}:${currentUser.id}`,
        members: {
          create: [{ userId: currentUser.id }, { userId: targetUser.id }],
        },
      },
      include: expect.any(Object),
    });
    expect(result.conversation.members).toHaveLength(2);
    expect(result.conversation.lastMessage).toBeNull();
  });

  it('rejects creating a direct conversation with yourself', async () => {
    await expect(
      service.createOrGetDirectConversation(currentUser.id, currentUser.id),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns not found when target user is missing, deleted, or inactive', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.createOrGetDirectConversation(currentUser.id, targetUser.id),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists conversations for the current user with other members, last message, and unread count', async () => {
    prisma.conversation.findMany.mockResolvedValue([conversation]);
    prisma.message.count.mockResolvedValue(1);

    const result = await service.listConversations(currentUser.id, { limit: 20 });

    expect(prisma.conversation.findMany).toHaveBeenCalledWith({
      where: {
        members: {
          some: {
            userId: currentUser.id,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      cursor: undefined,
      skip: undefined,
      include: expect.any(Object),
    });
    expect(result.items[0]?.members).toEqual([
      {
        user: targetUser,
        joinedAt: createdAt,
        lastSeenMessageId: null,
        lastSeenAt: null,
      },
    ]);
    expect(result.items[0]?.lastMessage?.id).toBe(firstMessageId);
    expect(result.items[0]?.unreadCount).toBe(1);
  });

  it('rejects message history for a non-member', async () => {
    prisma.conversation.findUnique.mockResolvedValue({ id: conversationId });
    prisma.conversationMember.findUnique.mockResolvedValue(null);

    await expect(
      service.getMessages(currentUser.id, conversationId, { limit: 30 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns paginated messages for a conversation member', async () => {
    prisma.conversation.findUnique.mockResolvedValue({ id: conversationId });
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.message.findMany.mockResolvedValue([
      {
        id: firstMessageId,
        conversationId,
        sender: targetUser,
        type: 'TEXT',
        text: 'Newest',
        createdAt: updatedAt,
        updatedAt,
      },
      {
        id: secondMessageId,
        conversationId,
        sender: currentUser,
        type: 'TEXT',
        text: 'Older',
        createdAt,
        updatedAt: createdAt,
      },
    ]);

    const result = await service.getMessages(currentUser.id, conversationId, { limit: 1 });

    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 2,
      cursor: undefined,
      skip: undefined,
      include: expect.any(Object),
    });
    expect(result.items).toEqual([
      {
        id: firstMessageId,
        conversationId,
        sender: targetUser,
        type: 'text',
        content: 'Newest',
        text: 'Newest',
        mediaUrl: null,
        deletedAt: null,
        createdAt: updatedAt,
        updatedAt,
      },
    ]);
    expect(result.pageInfo).toEqual({
      nextCursor: firstMessageId,
      hasNextPage: true,
    });
  });

  it('saves a text message after membership validation', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.message.create.mockResolvedValue({
      id: firstMessageId,
      conversationId,
      sender: currentUser,
      type: 'TEXT',
      text: 'Hello over socket.',
      createdAt: updatedAt,
      updatedAt,
    });
    prisma.conversation.update.mockResolvedValue({ id: conversationId });
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: targetUser.id }]);

    const result = await service.sendTextMessage(currentUser.id, {
      conversationId,
      clientMessageId: 'local-1',
      text: '  Hello over socket.  ',
    });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        conversationId,
        senderId: currentUser.id,
        type: 'TEXT',
        content: 'Hello over socket.',
        text: 'Hello over socket.',
        mediaUrl: undefined,
      },
      include: expect.any(Object),
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: conversationId },
      data: {
        lastMessageId: firstMessageId,
        updatedAt: updatedAt,
      },
      select: { id: true },
    });
    expect(notificationsService.createMessageNotification).toHaveBeenCalledWith({
      actorId: currentUser.id,
      recipientId: targetUser.id,
      conversationId,
      messageId: firstMessageId,
    });
    expect(result).toEqual({
      clientMessageId: 'local-1',
      message: {
        id: firstMessageId,
        conversationId,
        sender: currentUser,
        type: 'text',
        content: 'Hello over socket.',
        text: 'Hello over socket.',
        mediaUrl: null,
        deletedAt: null,
        createdAt: updatedAt,
        updatedAt,
      },
    });
  });

  it('saves socket messages using clientTempId and content fields', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.message.create.mockResolvedValue({
      id: firstMessageId,
      conversationId,
      sender: currentUser,
      type: 'TEXT',
      text: 'Hello over socket.',
      content: 'Hello over socket.',
      mediaUrl: null,
      deletedAt: null,
      createdAt: updatedAt,
      updatedAt,
    });
    prisma.conversation.update.mockResolvedValue({ id: conversationId });
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: targetUser.id }]);

    const result = await service.sendTextMessage(currentUser.id, {
      conversationId,
      clientTempId: 'local-1',
      content: '  Hello over socket.  ',
      type: 'text',
    });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        conversationId,
        senderId: currentUser.id,
        type: 'TEXT',
        text: 'Hello over socket.',
        content: 'Hello over socket.',
        mediaUrl: undefined,
      },
      include: expect.any(Object),
    });
    expect(result).toEqual({
      clientTempId: 'local-1',
      message: {
        id: firstMessageId,
        conversationId,
        sender: currentUser,
        type: 'text',
        text: 'Hello over socket.',
        content: 'Hello over socket.',
        mediaUrl: null,
        deletedAt: null,
        createdAt: updatedAt,
        updatedAt,
      },
    });
  });

  it('rejects empty socket messages after trimming', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'member-id' });

    await expect(
      service.sendTextMessage(currentUser.id, {
        conversationId,
        text: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks a conversation message as seen for a member', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'member-id', lastSeenAt: null });
    prisma.message.findFirst.mockResolvedValue({
      id: firstMessageId,
      conversationId,
      senderId: targetUser.id,
      createdAt: updatedAt,
    });
    prisma.conversationMember.update.mockResolvedValue({
      userId: currentUser.id,
      conversationId,
      lastSeenMessageId: firstMessageId,
      lastSeenAt: updatedAt,
    });

    const result = await service.markSeen(currentUser.id, {
      conversationId,
      messageId: firstMessageId,
    });

    expect(prisma.conversationMember.update).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id,
        },
      },
      data: {
        lastSeenMessageId: firstMessageId,
        lastSeenAt: updatedAt,
      },
      select: {
        userId: true,
        conversationId: true,
        lastSeenMessageId: true,
        lastSeenAt: true,
      },
    });
    expect(result).toEqual({
      conversationId,
      userId: currentUser.id,
      messageId: firstMessageId,
      seenAt: updatedAt,
    });
  });

  it('skips mark seen updates for your own message', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'member-id', lastSeenAt: null });
    prisma.message.findFirst.mockResolvedValue({
      id: firstMessageId,
      conversationId,
      senderId: currentUser.id,
      createdAt: updatedAt,
    });

    const result = await service.markSeen(currentUser.id, {
      conversationId,
      messageId: firstMessageId,
    });

    expect(prisma.conversationMember.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      conversationId,
      userId: currentUser.id,
      messageId: firstMessageId,
      seenAt: updatedAt,
      skipped: true,
    });
  });
});
