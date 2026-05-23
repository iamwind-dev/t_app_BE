import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { getCorsOrigins } from '../common/config/cors.util';
import { RealtimeRoomsDto } from './dto/realtime-room.dto';
import { RealtimeEventsService } from './realtime-events.service';

type SocketAck = (response: {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}) => void;

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
  };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: getCorsOrigins(process.env),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    this.realtimeEventsService.bindServer(this.server);
    const token = this.extractToken(client);

    if (!token) {
      client.emit('auth_error', {
        code: 'AUTH_TOKEN_MISSING',
        message: 'JWT access token is required.',
      });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
    } catch (error) {
      const code = this.isJwtExpiredError(error) ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID';
      client.emit('auth_error', {
        code,
        message: 'Access token is invalid or expired.',
      });
      this.logger.warn(
        `Realtime connect rejected: socketId=${client.id} code=${code} error=${this.getErrorMessage(error)}`,
      );
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe_rooms')
  async subscribeRooms(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SocketAck,
  ): Promise<void> {
    const userId = this.requireUserId(client);
    const dto = this.validatePayload(RealtimeRoomsDto, payload);
    if (!dto) {
      this.ackError(ack, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid subscribe payload.',
      });
      return;
    }

    for (const room of dto.rooms) {
      if (room.startsWith('user:') && room !== `user:${userId}`) {
        this.ackError(ack, {
          code: 'REALTIME_ROOM_FORBIDDEN',
          message: 'Cannot subscribe to another user room.',
          details: { room },
        });
        return;
      }
    }

    await Promise.all(dto.rooms.map((room) => client.join(room)));
    this.ackSuccess(ack, { rooms: dto.rooms });
  }

  @SubscribeMessage('unsubscribe_rooms')
  async unsubscribeRooms(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SocketAck,
  ): Promise<void> {
    const dto = this.validatePayload(RealtimeRoomsDto, payload);
    if (!dto) {
      this.ackError(ack, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid unsubscribe payload.',
      });
      return;
    }

    await Promise.all(dto.rooms.map((room) => client.leave(room)));
    this.ackSuccess(ack, { rooms: dto.rooms });
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

  private requireUserId(client: AuthenticatedSocket): string {
    if (!client.data.userId) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }

    return client.data.userId;
  }

  private validatePayload<T extends object>(dtoClass: new () => T, payload: unknown): T | null {
    const dto = plainToInstance(dtoClass, payload);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    return errors.length === 0 ? dto : null;
  }

  private ackSuccess(ack: SocketAck | undefined, data: unknown): void {
    ack?.({
      success: true,
      data,
    });
  }

  private ackError(
    ack: SocketAck | undefined,
    error: {
      code: string;
      message: string;
      details?: unknown;
    },
  ): void {
    ack?.({
      success: false,
      error,
    });
  }

  private isJwtExpiredError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: unknown }).name === 'TokenExpiredError'
    );
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown';
  }
}
