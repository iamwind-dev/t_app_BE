import { JwtService } from '@nestjs/jwt';
import { RealtimeEventsService } from './realtime-events.service';
import { RealtimeGateway } from './realtime.gateway';

type MockSocket = {
  id: string;
  data: { userId?: string };
  handshake: {
    auth?: { token?: string };
    headers?: { authorization?: string };
  };
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
};

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: { verifyAsync: jest.Mock };
  let realtimeEventsService: { bindServer: jest.Mock };

  function createSocket(token?: string): MockSocket {
    return {
      id: 'socket-1',
      data: {},
      handshake: {
        auth: token ? { token } : {},
        headers: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
  }

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    realtimeEventsService = {
      bindServer: jest.fn(),
    };
    gateway = new RealtimeGateway(
      jwtService as unknown as JwtService,
      realtimeEventsService as unknown as RealtimeEventsService,
    );
    gateway.server = {} as never;
  });

  it('emits auth_error AUTH_TOKEN_MISSING and disconnects when token is missing', async () => {
    const socket = createSocket();

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith('auth_error', {
      code: 'AUTH_TOKEN_MISSING',
      message: 'JWT access token is required.',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('emits auth_error AUTH_TOKEN_EXPIRED and disconnects when token is expired', async () => {
    const socket = createSocket('expired-token');
    jwtService.verifyAsync.mockRejectedValue({ name: 'TokenExpiredError', message: 'jwt expired' });

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith('auth_error', {
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Access token is invalid or expired.',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('subscribes and unsubscribes rooms with ack success', async () => {
    const socket = createSocket('ok-token');
    socket.data.userId = '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
    const subscribeAck = jest.fn();
    const unsubscribeAck = jest.fn();

    await gateway.subscribeRooms(
      socket as never,
      { rooms: ['feed:global', 'thread:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1'] },
      subscribeAck,
    );
    await gateway.unsubscribeRooms(
      socket as never,
      { rooms: ['feed:global'] },
      unsubscribeAck,
    );

    expect(socket.join).toHaveBeenCalledWith('feed:global');
    expect(socket.join).toHaveBeenCalledWith('thread:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1');
    expect(socket.leave).toHaveBeenCalledWith('feed:global');
    expect(subscribeAck).toHaveBeenCalledWith({
      success: true,
      data: { rooms: ['feed:global', 'thread:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1'] },
    });
    expect(unsubscribeAck).toHaveBeenCalledWith({
      success: true,
      data: { rooms: ['feed:global'] },
    });
  });

  it('rejects subscribe to another user room', async () => {
    const socket = createSocket('ok-token');
    socket.data.userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const ack = jest.fn();

    await gateway.subscribeRooms(socket as never, { rooms: ['user:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] }, ack);

    expect(ack).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'REALTIME_ROOM_FORBIDDEN',
        message: 'Cannot subscribe to another user room.',
        details: { room: 'user:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      },
    });
  });
});

