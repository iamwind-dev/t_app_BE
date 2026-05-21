import { DomainEventsController } from './domain-events.controller';
import { DomainEventsService } from './domain-events.service';
import { OutboxPublisherService } from './outbox-publisher.service';

describe('DomainEventsController', () => {
  let controller: DomainEventsController;
  let domainEventsService: {
    listEventsForSync: jest.Mock;
    countUnpublishedEvents: jest.Mock;
    getOldestUnpublishedEventMeta: jest.Mock;
    listPendingOutboxEvents: jest.Mock;
  };
  let outboxPublisherService: {
    getStats: jest.Mock;
  };

  beforeEach(() => {
    domainEventsService = {
      listEventsForSync: jest.fn(),
      countUnpublishedEvents: jest.fn(),
      getOldestUnpublishedEventMeta: jest.fn(),
      listPendingOutboxEvents: jest.fn(),
    };
    outboxPublisherService = {
      getStats: jest.fn(),
    };
    controller = new DomainEventsController(
      domainEventsService as unknown as DomainEventsService,
      outboxPublisherService as unknown as OutboxPublisherService,
    );
  });

  it('GET /sync/events maps query and returns items', async () => {
    domainEventsService.listEventsForSync.mockResolvedValue([{ eventId: 'e1' }]);

    const result = await controller.syncEvents(
      { id: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1' } as never,
      {
        sinceEventId: 'e0',
        sinceOccurredAt: undefined,
        limit: 50,
        rooms: 'feed:global,thread:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      },
    );

    expect(domainEventsService.listEventsForSync).toHaveBeenCalledWith(
      '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      {
        sinceEventId: 'e0',
        sinceOccurredAt: undefined,
        limit: 50,
        rooms: ['feed:global', 'thread:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1'],
      },
    );
    expect(result).toEqual({ items: [{ eventId: 'e1' }] });
  });

  it('GET /sync/outbox/stats returns queue + publisher stats', async () => {
    domainEventsService.countUnpublishedEvents.mockResolvedValue(3);
    domainEventsService.getOldestUnpublishedEventMeta.mockResolvedValue({
      eventId: 'e1',
      type: 'post.created',
      subjectType: 'POST',
      subjectId: 'p1',
      orderingKey: 'POST:p1',
      occurredAt: '2026-05-21T10:00:00.000Z',
    });
    outboxPublisherService.getStats.mockReturnValue({
      isRunning: false,
      startedAt: '2026-05-21T09:00:00.000Z',
    });

    const result = await controller.getOutboxStats();

    expect(result).toEqual({
      queue: {
        pendingCount: 3,
        oldestPendingEvent: {
          eventId: 'e1',
          type: 'post.created',
          subjectType: 'POST',
          subjectId: 'p1',
          orderingKey: 'POST:p1',
          occurredAt: '2026-05-21T10:00:00.000Z',
        },
      },
      publisher: {
        isRunning: false,
        startedAt: '2026-05-21T09:00:00.000Z',
      },
    });
  });

  it('GET /sync/outbox/pending parses limit and returns pending items', async () => {
    domainEventsService.listPendingOutboxEvents.mockResolvedValue([{ eventId: 'e2' }]);

    const result = await controller.getPendingOutboxEvents('25');

    expect(domainEventsService.listPendingOutboxEvents).toHaveBeenCalledWith(25);
    expect(result).toEqual({ items: [{ eventId: 'e2' }] });
  });

  it('GET /sync/outbox/metrics returns prometheus text payload', async () => {
    domainEventsService.countUnpublishedEvents.mockResolvedValue(5);
    outboxPublisherService.getStats.mockReturnValue({
      totalPublishedSuccess: 10,
      totalPublishFail: 2,
      totalRetryCount: 2,
      lastTickDurationMs: 111,
      lastTickPendingCount: 5,
      lastTickProcessedCount: 4,
      isRunning: false,
    });

    const result = await controller.getOutboxMetrics();

    expect(result).toContain('outbox_pending_events 5');
    expect(result).toContain('outbox_published_success_total 10');
    expect(result).toContain('outbox_publish_fail_total 2');
    expect(result).toContain('outbox_retry_total 2');
    expect(result).toContain('outbox_last_tick_duration_ms 111');
    expect(result).toContain('outbox_publisher_running 0');
  });
});
