import { BadRequestException } from '@nestjs/common';
import { DomainEventsService } from './domain-events.service';

describe('DomainEventsService', () => {
  const occurredAt = new Date('2026-05-21T09:00:00.000Z');

  let prisma: {
    domainEventOutbox: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: DomainEventsService;

  beforeEach(() => {
    prisma = {
      domainEventOutbox: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new DomainEventsService(prisma as never);
  });

  it('creates event with default orderingKey based on subject', async () => {
    prisma.domainEventOutbox.create.mockResolvedValue({
      id: 'dcd649ad-df76-4f69-8aa4-e1d96a442f58',
      type: 'post.updated',
      actorId: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      subjectType: 'POST',
      subjectId: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      orderingKey: 'POST:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      rooms: ['feed:global'],
      payload: { ok: true },
      occurredAt,
    });

    const event = await service.createEvent({
      type: 'post.updated',
      actorId: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      subjectType: 'POST',
      subjectId: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      rooms: ['feed:global'],
      payload: { ok: true },
    });

    expect(prisma.domainEventOutbox.create).toHaveBeenCalledWith({
      data: {
        type: 'post.updated',
        actorId: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
        subjectType: 'POST',
        subjectId: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
        orderingKey: 'POST:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
        rooms: ['feed:global'],
        payload: { ok: true },
      },
    });
    expect(event.orderingKey).toBe('POST:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1');
    expect(event.orderingValue).toBe(
      '2026-05-21T09:00:00.000Z#dcd649ad-df76-4f69-8aa4-e1d96a442f58',
    );
    expect(event.occurredAt).toBe(occurredAt.toISOString());
  });

  it('uses custom orderingKey when provided', async () => {
    prisma.domainEventOutbox.create.mockResolvedValue({
      id: 'dcd649ad-df76-4f69-8aa4-e1d96a442f58',
      type: 'reply.created',
      actorId: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      subjectType: 'REPLY',
      subjectId: '6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32',
      orderingKey: 'THREAD:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      rooms: ['thread:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1'],
      payload: { ok: true },
      occurredAt,
    });

    await service.createEvent({
      type: 'reply.created',
      actorId: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
      subjectType: 'REPLY',
      subjectId: '6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32',
      orderingKey: 'THREAD:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      rooms: ['thread:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1'],
      payload: { ok: true },
    });

    expect(prisma.domainEventOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderingKey: 'THREAD:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      }),
    });
  });

  it('lists replay events since a known event id', async () => {
    prisma.domainEventOutbox.findFirst.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      occurredAt,
    });
    prisma.domainEventOutbox.findMany.mockResolvedValue([
      {
        id: '22222222-2222-4222-8222-222222222222',
        type: 'follow.created',
        actorId: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
        subjectType: 'FOLLOW',
        subjectId: '33333333-3333-4333-8333-333333333333',
        orderingKey: 'FOLLOW:33333333-3333-4333-8333-333333333333',
        rooms: ['user:aaaa', 'feed:global'],
        payload: { followerId: 'a' },
        occurredAt: new Date('2026-05-21T09:01:00.000Z'),
      },
    ]);

    const items = await service.listEventsForSync('aaaa', {
      sinceEventId: '11111111-1111-4111-8111-111111111111',
      rooms: ['feed:global'],
      limit: 20,
    });

    expect(prisma.domainEventOutbox.findMany).toHaveBeenCalledWith({
      where: {
        rooms: { hasSome: ['user:aaaa', 'feed:global'] },
        OR: [
          { occurredAt: { gt: occurredAt } },
          {
            occurredAt,
            id: { gt: '11111111-1111-4111-8111-111111111111' },
          },
        ],
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    expect(items[0]?.eventId).toBe('22222222-2222-4222-8222-222222222222');
    expect(items[0]?.orderingKey).toBe('FOLLOW:33333333-3333-4333-8333-333333333333');
  });

  it('throws when sinceEventId cannot be found', async () => {
    prisma.domainEventOutbox.findFirst.mockResolvedValue(null);

    await expect(
      service.listEventsForSync('aaaa', {
        sinceEventId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('counts unpublished events', async () => {
    prisma.domainEventOutbox.count.mockResolvedValue(9);

    const total = await service.countUnpublishedEvents();

    expect(total).toBe(9);
    expect(prisma.domainEventOutbox.count).toHaveBeenCalledWith({
      where: { publishedAt: null },
    });
  });

  it('gets oldest unpublished event metadata', async () => {
    prisma.domainEventOutbox.findFirst.mockResolvedValue({
      id: 'dcd649ad-df76-4f69-8aa4-e1d96a442f58',
      type: 'post.created',
      subjectType: 'POST',
      subjectId: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      orderingKey: 'POST:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      occurredAt,
    });

    const meta = await service.getOldestUnpublishedEventMeta();

    expect(meta).toEqual({
      eventId: 'dcd649ad-df76-4f69-8aa4-e1d96a442f58',
      type: 'post.created',
      subjectType: 'POST',
      subjectId: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      orderingKey: 'POST:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
      occurredAt: occurredAt.toISOString(),
    });
  });

  it('lists pending outbox events with bounded limit', async () => {
    prisma.domainEventOutbox.findMany.mockResolvedValue([
      {
        id: '22222222-2222-4222-8222-222222222222',
        type: 'follow.created',
        actorId: '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1',
        subjectType: 'FOLLOW',
        subjectId: '33333333-3333-4333-8333-333333333333',
        orderingKey: 'FOLLOW:33333333-3333-4333-8333-333333333333',
        rooms: ['user:aaaa'],
        payload: { followerId: 'a' },
        occurredAt,
      },
    ]);

    const items = await service.listPendingOutboxEvents(999);

    expect(prisma.domainEventOutbox.findMany).toHaveBeenCalledWith({
      where: { publishedAt: null },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: 200,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.eventId).toBe('22222222-2222-4222-8222-222222222222');
  });
});
