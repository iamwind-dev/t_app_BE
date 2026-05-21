import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { InternalOpsGuard } from '../common/guards/internal-ops.guard';
import { SyncEventsQueryDto } from './dto/sync-events-query.dto';
import { DomainEventsService } from './domain-events.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { DomainEventEnvelope } from './types/domain-event.type';

@ApiTags('Realtime Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class DomainEventsController {
  constructor(
    private readonly domainEventsService: DomainEventsService,
    private readonly outboxPublisherService: OutboxPublisherService,
  ) {}

  @Get('events')
  @ApiOkResponse({ description: 'Domain events for realtime catch-up sync.' })
  async syncEvents(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: SyncEventsQueryDto,
  ): Promise<{ items: DomainEventEnvelope[] }> {
    const roomList = query.rooms
      ? query.rooms
          .split(',')
          .map((room) => room.trim())
          .filter((room) => room.length > 0)
      : ['feed:global'];

    const items = await this.domainEventsService.listEventsForSync(currentUser.id, {
      sinceEventId: query.sinceEventId,
      sinceOccurredAt: query.sinceOccurredAt,
      limit: query.limit,
      rooms: roomList,
    });

    return { items };
  }

  @Get('outbox/stats')
  @UseGuards(JwtAuthGuard, InternalOpsGuard)
  @ApiOkResponse({ description: 'Outbox queue and publisher health stats.' })
  async getOutboxStats(): Promise<{
    queue: {
      pendingCount: number;
      oldestPendingEvent: {
        eventId: string;
        type: string;
        subjectType: string;
        subjectId: string;
        orderingKey: string;
        occurredAt: string;
      } | null;
    };
    publisher: ReturnType<OutboxPublisherService['getStats']>;
  }> {
    const [pendingCount, oldestPendingEvent] = await Promise.all([
      this.domainEventsService.countUnpublishedEvents(),
      this.domainEventsService.getOldestUnpublishedEventMeta(),
    ]);

    return {
      queue: {
        pendingCount,
        oldestPendingEvent,
      },
      publisher: this.outboxPublisherService.getStats(),
    };
  }

  @Get('outbox/pending')
  @UseGuards(JwtAuthGuard, InternalOpsGuard)
  @ApiOkResponse({ description: 'Sample pending outbox events for ops inspection.' })
  async getPendingOutboxEvents(@Query('limit') limit?: string): Promise<{ items: DomainEventEnvelope[] }> {
    const parsedLimit = limit ? Number(limit) : 20;
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
    const items = await this.domainEventsService.listPendingOutboxEvents(safeLimit);
    return { items };
  }

  @Get('outbox/metrics')
  @UseGuards(JwtAuthGuard, InternalOpsGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOkResponse({ description: 'Prometheus metrics for outbox publisher.' })
  async getOutboxMetrics(): Promise<string> {
    const pendingCount = await this.domainEventsService.countUnpublishedEvents();
    const stats = this.outboxPublisherService.getStats();

    return [
      '# HELP outbox_pending_events Number of unpublished outbox events.',
      '# TYPE outbox_pending_events gauge',
      `outbox_pending_events ${pendingCount}`,
      '# HELP outbox_published_success_total Total outbox events successfully published.',
      '# TYPE outbox_published_success_total counter',
      `outbox_published_success_total ${stats.totalPublishedSuccess}`,
      '# HELP outbox_publish_fail_total Total outbox publish failures.',
      '# TYPE outbox_publish_fail_total counter',
      `outbox_publish_fail_total ${stats.totalPublishFail}`,
      '# HELP outbox_retry_total Total outbox retry attempts.',
      '# TYPE outbox_retry_total counter',
      `outbox_retry_total ${stats.totalRetryCount}`,
      '# HELP outbox_last_tick_duration_ms Duration of last outbox tick in milliseconds.',
      '# TYPE outbox_last_tick_duration_ms gauge',
      `outbox_last_tick_duration_ms ${stats.lastTickDurationMs}`,
      '# HELP outbox_last_tick_pending_count Pending events observed in last outbox tick.',
      '# TYPE outbox_last_tick_pending_count gauge',
      `outbox_last_tick_pending_count ${stats.lastTickPendingCount}`,
      '# HELP outbox_last_tick_processed_count Successfully processed events in last outbox tick.',
      '# TYPE outbox_last_tick_processed_count gauge',
      `outbox_last_tick_processed_count ${stats.lastTickProcessedCount}`,
      '# HELP outbox_publisher_running Whether outbox publisher is running (1=true, 0=false).',
      '# TYPE outbox_publisher_running gauge',
      `outbox_publisher_running ${stats.isRunning ? 1 : 0}`,
    ].join('\n');
  }
}
