import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PARAM_ARGS_METADATA } from '@nestjs/websockets/constants';
import { WsParamtype } from '@nestjs/websockets/enums/ws-paramtype.enum';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

type MockSocket = {
  data: { userId?: string };
  handshake: {
    auth?: { token?: string };
    headers?: { authorization?: string };
  };
  join: jest.Mock;
  leave: jest.Mock;
  to: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
};

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: {
    assertConversationMember: jest.Mock;
    sendTextMessage: jest.Mock;
    markSeen: jest.Mock;
  };
  let jwtService: {
    verifyAsync: jest.Mock;
  };
  let serverTo: jest.Mock;
  let serverRoomEmitter: { emit: jest.Mock };
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  const userId = '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
  const conversationId = '3a50afcb-17a4-4d7c-8f58-c3d280467ba1';
  const messageId = 'd3a5b71a-56a0-41e0-b985-46d6b7f613c2';

  function createSocket(token = 'jwt.access.token'): MockSocket {
    return {
      data: {},
      handshake: {
        auth: { token },
        headers: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
  }

  beforeEach(() => {
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    chatService = {
      assertConversationMember: jest.fn(),
      sendTextMessage: jest.fn(),
      markSeen: jest.fn(),
    };
    jwtService = {
      verifyAsync: jest.fn(),
    };
    gateway = new ChatGateway(
      chatService as unknown as ChatService,
      jwtService as unknown as JwtService,
    );
    serverRoomEmitter = { emit: jest.fn() };
    serverTo = jest.fn().mockReturnValue(serverRoomEmitter);
    gateway.server = {
      to: serverTo,
    } as never;
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  it('authenticates socket connections with JWT and stores user id on socket data', async () => {
    const socket = createSocket();
    jwtService.verifyAsync.mockResolvedValue({ sub: userId });

    await gateway.handleConnection(socket as never);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('jwt.access.token');
    expect(socket.data.userId).toBe(userId);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects sockets without a valid token', async () => {
    const socket = createSocket(undefined);

    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Socket.IO connect rejected'),
    );
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.not.stringContaining('jwt.access.token'));
  });

  it('joins a conversation room only after membership validation', async () => {
    const socket = createSocket();
    socket.data.userId = userId;
    const receiverEmitter = { emit: jest.fn() };
    socket.to.mockReturnValue(receiverEmitter);
    const ack = jest.fn();

    await gateway.handleJoinConversation(socket as never, { conversationId }, ack);

    expect(chatService.assertConversationMember).toHaveBeenCalledWith(userId, conversationId);
    expect(socket.join).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(ack).toHaveBeenCalledWith({
      success: true,
      data: {
        conversationId,
        joined: true,
      },
    });
  });

  it('leaves a conversation room after membership validation', async () => {
    const socket = createSocket();
    socket.data.userId = userId;
    const ack = jest.fn();

    await gateway.handleLeaveConversation(socket as never, { conversationId }, ack);

    expect(chatService.assertConversationMember).toHaveBeenCalledWith(userId, conversationId);
    expect(socket.leave).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(ack).toHaveBeenCalledWith({
      success: true,
      data: {
        conversationId,
        left: true,
      },
    });
  });

  it('logs socket handler errors without exposing credentials', async () => {
    const socket = createSocket();
    socket.data.userId = userId;
    const ack = jest.fn();
    chatService.assertConversationMember.mockRejectedValue({
      code: 'CHAT_FORBIDDEN',
      message: 'You are not a member of this conversation.',
    });

    await gateway.handleJoinConversation(socket as never, { conversationId }, ack);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Socket.IO join_conversation failed'),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(userId));
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.not.stringContaining('jwt.access.token'));
  });

  it.each([
    'handleJoinConversation',
    'handleLeaveConversation',
    'handleSendMessage',
    'handleTypingStart',
    'handleTypingStop',
    'handleMarkSeen',
  ])('binds socket ack callback for %s', (methodName) => {
    const metadata = Reflect.getMetadata(PARAM_ARGS_METADATA, ChatGateway, methodName) as
      | Record<string, { index: number }>
      | undefined;

    expect(metadata).toBeDefined();
    expect(metadata).toHaveProperty(`${WsParamtype.ACK}:2`);
  });

  it('sends a message then emits new_message to receivers and message_sent to sender', async () => {
    const socket = createSocket();
    socket.data.userId = userId;
    const receiverEmitter = { emit: jest.fn() };
    socket.to.mockReturnValue(receiverEmitter);
    const ack = jest.fn();
    const messageResult = {
      clientTempId: 'local-1',
      message: {
        id: messageId,
        conversationId,
        sender: {
          id: userId,
          username: 'current_user',
          displayName: 'Current User',
          avatarUrl: null,
        },
        type: 'text',
        text: 'Hello!',
        createdAt: new Date('2026-04-24T14:04:00.000Z'),
        updatedAt: new Date('2026-04-24T14:04:00.000Z'),
      },
    };
    chatService.sendTextMessage.mockResolvedValue(messageResult);

    await gateway.handleSendMessage(
      socket as never,
      { conversationId, clientTempId: 'local-1', content: 'Hello!', type: 'text' },
      ack,
    );

    expect(chatService.sendTextMessage).toHaveBeenCalledWith(userId, {
      conversationId,
      clientTempId: 'local-1',
      content: 'Hello!',
      type: 'text',
    });
    expect(socket.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(receiverEmitter.emit).toHaveBeenCalledWith('new_message', {
      conversationId,
      message: messageResult.message,
    });
    expect(socket.emit).toHaveBeenCalledWith('message_sent', messageResult);
    expect(ack).toHaveBeenCalledWith({
      success: true,
      data: messageResult,
    });
  });

  it('broadcasts typing start and stop to other room members only', async () => {
    const socket = createSocket();
    socket.data.userId = userId;
    const roomEmitter = { emit: jest.fn() };
    socket.to.mockReturnValue(roomEmitter);

    await gateway.handleTypingStart(socket as never, { conversationId }, jest.fn());
    await gateway.handleTypingStop(socket as never, { conversationId }, jest.fn());

    expect(chatService.assertConversationMember).toHaveBeenCalledTimes(2);
    expect(socket.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(roomEmitter.emit).toHaveBeenCalledWith('user_typing_start', {
      conversationId,
      userId,
      occurredAt: expect.any(String),
    });
    expect(roomEmitter.emit).toHaveBeenCalledWith('user_typing_stop', {
      conversationId,
      userId,
      occurredAt: expect.any(String),
    });
  });

  it('marks messages seen and emits message_seen to the room', async () => {
    const socket = createSocket();
    socket.data.userId = userId;
    const ack = jest.fn();
    const seenResult = {
      conversationId,
      userId,
      messageId,
      seenAt: new Date('2026-04-24T14:05:00.000Z'),
    };
    chatService.markSeen.mockResolvedValue(seenResult);

    await gateway.handleMarkSeen(socket as never, { conversationId, messageId }, ack);

    expect(chatService.markSeen).toHaveBeenCalledWith(userId, { conversationId, messageId });
    expect(serverTo).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(serverRoomEmitter.emit).toHaveBeenCalledWith('message_seen', seenResult);
    expect(ack).toHaveBeenCalledWith({
      success: true,
      data: seenResult,
    });
  });
});
