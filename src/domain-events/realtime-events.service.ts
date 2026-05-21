import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { DomainEventEnvelope } from './types/domain-event.type';

@Injectable()
export class RealtimeEventsService {
  private readonly logger = new Logger(RealtimeEventsService.name);
  private server: Server | null = null;

  bindServer(server: Server): void {
    this.server = server;
  }

  publish(event: DomainEventEnvelope): void {
    if (!this.server) {
      return;
    }

    for (const room of event.rooms) {
      this.server.to(room).emit('domain_event', event);
    }
  }

  publishMany(events: DomainEventEnvelope[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }

  logPublishFailure(eventId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : 'unknown';
    this.logger.error(`Failed to publish domain event: eventId=${eventId} error=${message}`);
  }
}
