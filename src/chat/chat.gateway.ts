import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import {
  JoinConversationPayloadDto,
  LeaveConversationPayloadDto,
  MarkSeenPayloadDto,
  SendMessagePayloadDto,
  TypingPayloadDto,
} from './dto/socket-chat.dto';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { getCorsOrigins } from '../common/config/cors.util';

type SocketAck = (response: SocketAckResponse) => void;

interface SocketAckResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(process.env),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = this.extractToken(client);

    if (!token) {
      this.logger.warn(
        `Socket.IO connect rejected: socketId=${this.getSocketId(client)} reason=missing_token`,
      );
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.userId = payload.sub;
    } catch (error) {
      this.logger.warn(
        `Socket.IO connect rejected: socketId=${this.getSocketId(client)} reason=invalid_token error=${this.getErrorMessage(error)}`,
      );
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SocketAck,
  ): Promise<void> {
    const dto = this.validatePayload(
      JoinConversationPayloadDto,
      payload,
      ack,
      client,
      'join_conversation',
    );
    if (!dto) {
      return;
    }

    try {
      const userId = this.requireSocketUser(client);
      await this.chatService.assertConversationMember(userId, dto.conversationId);
      await this.joinConversationRooms(client, dto.conversationId);
      this.ackSuccess(ack, {
        conversationId: dto.conversationId,
        joined: true,
      });
    } catch (error) {
      this.ackError(ack, client, this.toSocketError(error), 'join_conversation');
    }
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SocketAck,
  ): Promise<void> {
    const dto = this.validatePayload(
      LeaveConversationPayloadDto,
      payload,
      ack,
      client,
      'leave_conversation',
    );
    if (!dto) {
      return;
    }

    try {
      const userId = this.requireSocketUser(client);
      await this.chatService.assertConversationMember(userId, dto.conversationId);
      await this.leaveConversationRooms(client, dto.conversationId);
      this.ackSuccess(ack, {
        conversationId: dto.conversationId,
        left: true,
      });
    } catch (error) {
      this.ackError(ack, client, this.toSocketError(error), 'leave_conversation');
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SocketAck,
  ): Promise<void> {
    const dto = this.validatePayload(SendMessagePayloadDto, payload, ack, client, 'send_message');
    if (!dto) {
      return;
    }

    try {
      const userId = this.requireSocketUser(client);
      const result = await this.chatService.sendTextMessage(userId, dto);
      this.emitToConversationRooms(dto.conversationId, 'new_message', {
        conversationId: dto.conversationId,
        message: result.message,
      });
      client.emit('message_sent', result);
      this.ackSuccess(ack, result);
    } catch (error) {
      const socketError = this.toSocketError(error);
      client.emit('message_failed', {
        conversationId: dto.conversationId,
        clientTempId: dto.clientTempId ?? dto.clientMessageId,
        error: socketError,
      });
      this.ackError(ack, client, socketError, 'send_message');
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SocketAck,
  ): Promise<void> {
    const dto = this.validatePayload(TypingPayloadDto, payload, ack, client, 'typing_start');
    if (!dto) {
      return;
    }

    try {
      const userId = this.requireSocketUser(client);
      await this.chatService.assertConversationMember(userId, dto.conversationId);
      this.emitToConversationRooms(dto.conversationId, 'user_typing_start', {
        conversationId: dto.conversationId,
        userId,
        occurredAt: new Date().toISOString(),
      });
      this.ackSuccess(ack, {
        conversationId: dto.conversationId,
        isTyping: true,
      });
    } catch (error) {
      this.ackError(ack, client, this.toSocketError(error), 'typing_start');
    }
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SocketAck,
  ): Promise<void> {
    const dto = this.validatePayload(TypingPayloadDto, payload, ack, client, 'typing_stop');
    if (!dto) {
      return;
    }

    try {
      const userId = this.requireSocketUser(client);
      await this.chatService.assertConversationMember(userId, dto.conversationId);
      this.emitToConversationRooms(dto.conversationId, 'user_typing_stop', {
        conversationId: dto.conversationId,
        userId,
        occurredAt: new Date().toISOString(),
      });
      this.ackSuccess(ack, {
        conversationId: dto.conversationId,
        isTyping: false,
      });
    } catch (error) {
      this.ackError(ack, client, this.toSocketError(error), 'typing_stop');
    }
  }

  @SubscribeMessage('mark_seen')
  async handleMarkSeen(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SocketAck,
  ): Promise<void> {
    const dto = this.validatePayload(MarkSeenPayloadDto, payload, ack, client, 'mark_seen');
    if (!dto) {
      return;
    }

    try {
      const userId = this.requireSocketUser(client);
      const result = await this.chatService.markSeen(userId, dto);
      this.emitToConversationRooms(dto.conversationId, 'message_seen', result);
      this.ackSuccess(ack, result);
    } catch (error) {
      this.ackError(ack, client, this.toSocketError(error), 'mark_seen');
    }
  }

  private extractToken(client: AuthenticatedSocket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization !== 'string') {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  private requireSocketUser(client: AuthenticatedSocket): string {
    if (!client.data.userId) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }

    return client.data.userId;
  }

  private validatePayload<T extends object>(
    dtoClass: new () => T,
    payload: unknown,
    ack: SocketAck | undefined,
    client: AuthenticatedSocket,
    eventName: string,
  ): T | null {
    const dto = plainToInstance(dtoClass, payload);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length === 0) {
      return dto;
    }

    this.ackError(
      ack,
      client,
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid socket payload.',
        details: errors.map((error) => ({
          property: error.property,
          constraints: error.constraints,
        })),
      },
      eventName,
    );
    return null;
  }

  private getConversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private getChatRoom(conversationId: string): string {
    return `chat:${conversationId}`;
  }

  private getConversationRooms(conversationId: string): string[] {
    if (this.isLegacyConversationRoomEnabled()) {
      return [this.getChatRoom(conversationId), this.getConversationRoom(conversationId)];
    }

    return [this.getChatRoom(conversationId)];
  }

  private isLegacyConversationRoomEnabled(): boolean {
    const raw = process.env.CHAT_ENABLE_LEGACY_CONVERSATION_ROOM;
    if (!raw) {
      return true;
    }

    return raw.toLowerCase() !== 'false';
  }

  private async joinConversationRooms(
    client: AuthenticatedSocket,
    conversationId: string,
  ): Promise<void> {
    await Promise.all(this.getConversationRooms(conversationId).map((room) => client.join(room)));
  }

  private async leaveConversationRooms(
    client: AuthenticatedSocket,
    conversationId: string,
  ): Promise<void> {
    await Promise.all(this.getConversationRooms(conversationId).map((room) => client.leave(room)));
  }

  private emitToConversationRooms(
    conversationId: string,
    eventName: string,
    payload: unknown,
  ): void {
    for (const room of this.getConversationRooms(conversationId)) {
      this.server.to(room).emit(eventName, payload);
    }
  }

  private ackSuccess(ack: SocketAck | undefined, data: unknown): void {
    ack?.({
      success: true,
      data,
    });
  }

  private ackError(
    ack: SocketAck | undefined,
    client: AuthenticatedSocket,
    error: SocketAckResponse['error'],
    eventName: string,
  ): void {
    const response = {
      success: false,
      error,
    };

    this.logger.error(
      `Socket.IO ${eventName} failed: socketId=${this.getSocketId(client)} userId=${client.data.userId ?? 'unknown'} code=${error?.code ?? 'UNKNOWN'} message=${error?.message ?? 'Unknown socket error'}`,
    );

    if (ack) {
      ack(response);
      return;
    }

    client.emit('socket_error', response);
  }

  private toSocketError(error: unknown): SocketAckResponse['error'] {
    if (this.isStructuredError(error)) {
      return error;
    }

    if (this.isNestHttpException(error)) {
      const response = error.getResponse();

      if (this.isStructuredError(response)) {
        return response;
      }
    }

    return {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    };
  }

  private isStructuredError(error: unknown): error is SocketAckResponse['error'] {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      typeof (error as { message?: unknown }).message === 'string'
    );
  }

  private isNestHttpException(error: unknown): error is { getResponse(): unknown } {
    return typeof error === 'object' && error !== null && 'getResponse' in error;
  }

  private getSocketId(client: AuthenticatedSocket): string {
    return typeof client.id === 'string' && client.id.length > 0 ? client.id : 'unknown';
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown';
  }
}
