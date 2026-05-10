import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ConversationsController } from './conversations.controller';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let chatService: {
    createOrGetDirectConversation: jest.Mock;
    listConversations: jest.Mock;
    getMessages: jest.Mock;
    sendTextMessage: jest.Mock;
    markSeen: jest.Mock;
    deleteMessage: jest.Mock;
  };

  const currentUser = {
    id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
    email: 'me@example.com',
    username: 'me',
  };
  const conversationId = '3a50afcb-17a4-4d7c-8f58-c3d280467ba1';
  const message = {
    id: 'd3a5b71a-56a0-41e0-b985-46d6b7f613c2',
    conversationId,
    sender: {
      id: currentUser.id,
      username: currentUser.username,
      displayName: 'Me',
      avatarUrl: null,
    },
    type: 'text',
    text: 'Hello from REST',
    createdAt: new Date('2026-04-24T10:00:00.000Z'),
    updatedAt: new Date('2026-04-24T10:00:00.000Z'),
  };

  beforeEach(() => {
    chatService = {
      createOrGetDirectConversation: jest.fn(),
      listConversations: jest.fn(),
      getMessages: jest.fn(),
      sendTextMessage: jest.fn(),
      markSeen: jest.fn(),
      deleteMessage: jest.fn(),
    };
    controller = new ConversationsController(chatService as unknown as ChatService);
  });

  it('sends a text message over REST for socket fallback', async () => {
    chatService.sendTextMessage.mockResolvedValue({
      message,
    });

    const result = await controller.sendMessage(
      currentUser,
      { id: conversationId },
      { text: 'Hello from REST' },
      { status: jest.fn() } as unknown as Response,
    );

    expect(chatService.sendTextMessage).toHaveBeenCalledWith(currentUser.id, {
      conversationId,
      text: 'Hello from REST',
      type: 'text',
    });
    expect(result).toEqual({ message });
  });

  it('marks a conversation message as seen over REST', async () => {
    const seenAt = new Date('2026-04-24T10:05:00.000Z');
    chatService.markSeen.mockResolvedValue({
      conversationId,
      userId: currentUser.id,
      messageId: message.id,
      seenAt,
    });

    const result = await controller.markSeen(
      currentUser,
      { id: conversationId },
      { messageId: message.id },
    );

    expect(chatService.markSeen).toHaveBeenCalledWith(currentUser.id, {
      conversationId,
      messageId: message.id,
    });
    expect(result).toEqual({
      conversationId,
      userId: currentUser.id,
      messageId: message.id,
      seenAt,
    });
  });

  it('soft deletes a conversation message over REST', async () => {
    const deletedAt = new Date('2026-04-24T10:10:00.000Z');
    chatService.deleteMessage.mockResolvedValue({
      deleted: true,
      id: message.id,
      conversationId,
      deletedAt,
    });

    const result = await controller.deleteMessage(currentUser, {
      id: conversationId,
      messageId: message.id,
    });

    expect(chatService.deleteMessage).toHaveBeenCalledWith(
      currentUser.id,
      conversationId,
      message.id,
    );
    expect(result).toEqual({
      deleted: true,
      id: message.id,
      conversationId,
      deletedAt,
    });
  });
});
