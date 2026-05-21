import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DomainEventsService } from './domain-events.service';
import { RealtimeEventsService } from './realtime-events.service';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly intervalMs = 3000;
  private readonly batchSize = 100;
  private isDisabled = false;
  private readonly startedAt = new Date();
  private lastTickAt: Date | null = null;
  private lastTickDurationMs = 0;
  private lastTickPendingCount = 0;
  private lastTickProcessedCount = 0;
  private totalPublishedSuccess = 0;
  private totalPublishFail = 0;
  private totalRetryCount = 0;

  constructor(
    private readonly domainEventsService: DomainEventsService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.publishPendingEvents();
    }, this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStats(): {
    isRunning: boolean;
    isDisabled: boolean;
    startedAt: string;
    intervalMs: number;
    batchSize: number;
    lastTickAt: string | null;
    lastTickDurationMs: number;
    lastTickPendingCount: number;
    lastTickProcessedCount: number;
    totalPublishedSuccess: number;
    totalPublishFail: number;
    totalRetryCount: number;
  } {
    return {
      isRunning: this.isRunning,
      isDisabled: this.isDisabled,
      startedAt: this.startedAt.toISOString(),
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
      lastTickAt: this.lastTickAt?.toISOString() ?? null,
      lastTickDurationMs: this.lastTickDurationMs,
      lastTickPendingCount: this.lastTickPendingCount,
      lastTickProcessedCount: this.lastTickProcessedCount,
      totalPublishedSuccess: this.totalPublishedSuccess,
      totalPublishFail: this.totalPublishFail,
      totalRetryCount: this.totalRetryCount,
    };
  }

  private async publishPendingEvents(): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const tickStartedAt = Date.now();
    try {
      const events = await this.domainEventsService.listUnpublishedEvents(this.batchSize);
      this.lastTickPendingCount = events.length;
      this.lastTickProcessedCount = 0;
      for (const event of events) {
        try {
          this.realtimeEventsService.publish(event);
          await this.domainEventsService.markPublished(event.eventId);
          this.totalPublishedSuccess += 1;
          this.lastTickProcessedCount += 1;
        } catch (error) {
          this.totalPublishFail += 1;
          this.totalRetryCount += 1;
          this.realtimeEventsService.logPublishFailure(event.eventId, error);
        }
      }
      if (events.length > 0) {
        this.logger.log(
          `Outbox tick done: pending=${events.length} success=${this.lastTickProcessedCount} fail=${events.length - this.lastTickProcessedCount} retryTotal=${this.totalRetryCount}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.error(`Outbox publish tick failed: ${message}`);
      if (
        message.includes('Prisma delegate "domainEventOutbox" is missing')
      ) {
        this.isDisabled = true;
        this.logger.error(
          'Outbox publisher disabled due to missing Prisma outbox delegate. Fix Prisma generate/migration and restart service.',
        );
      }
    } finally {
      this.lastTickAt = new Date();
      this.lastTickDurationMs = Date.now() - tickStartedAt;
      this.isRunning = false;
    }
  }
}
