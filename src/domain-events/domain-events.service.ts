import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDomainEventInput, DomainEventEnvelope } from './types/domain-event.type';

interface DomainEventOutboxRecord {
  id: string;
  type: string;
  actorId: string | null;
  subjectType: string;
  subjectId: string;
  orderingKey: string;
  rooms: string[];
  payload: unknown;
  occurredAt: Date;
}

interface DomainEventOutboxDelegate {
  create(args: {
    data: {
      type: string;
      actorId?: string | null;
      subjectType: string;
      subjectId: string;
      orderingKey: string;
      rooms: string[];
      payload: Prisma.InputJsonValue;
      occurredAt?: Date;
    };
  }): Promise<DomainEventOutboxRecord>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: {
    where: unknown;
    orderBy: Array<{ occurredAt: 'asc' | 'desc' } | { id: 'asc' | 'desc' }>;
    take: number;
  }): Promise<DomainEventOutboxRecord[]>;
  count(args: { where: unknown }): Promise<number>;
  update(args: { where: { id: string }; data: { publishedAt: Date } }): Promise<unknown>;
}

@Injectable()
export class DomainEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(
    input: CreateDomainEventInput,
    tx?: { domainEventOutbox: { create(args: unknown): Promise<unknown> } },
  ): Promise<DomainEventEnvelope> {
    const delegate =
      tx?.domainEventOutbox ?? (this.domainEventOutbox() as unknown as { create(args: unknown): Promise<unknown> });
    const event = (await delegate.create({
      data: {
        type: input.type,
        actorId: input.actorId ?? null,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        orderingKey: this.resolveOrderingKey(input),
        rooms: input.rooms,
        payload: input.payload as Prisma.InputJsonValue,
      },
    })) as DomainEventOutboxRecord;

    return this.toEnvelope(event);
  }

  async markPublished(eventId: string): Promise<void> {
    await this.domainEventOutbox().update({
      where: { id: eventId },
      data: { publishedAt: new Date() },
    });
  }

  async listUnpublishedEvents(limit = 100): Promise<DomainEventEnvelope[]> {
    const rows = await this.domainEventOutbox().findMany({
      where: {
        publishedAt: null,
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    return rows.map((row) => this.toEnvelope(row));
  }

  async countUnpublishedEvents(): Promise<number> {
    return this.domainEventOutbox().count({
      where: {
        publishedAt: null,
      },
    });
  }

  async getOldestUnpublishedEventMeta(): Promise<{
    eventId: string;
    type: string;
    subjectType: string;
    subjectId: string;
    orderingKey: string;
    occurredAt: string;
  } | null> {
    const row = (await this.domainEventOutbox().findFirst({
      where: {
        publishedAt: null,
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        subjectType: true,
        subjectId: true,
        orderingKey: true,
        occurredAt: true,
      },
    })) as
      | {
          id: string;
          type: string;
          subjectType: string;
          subjectId: string;
          orderingKey: string;
          occurredAt: Date;
        }
      | null;

    if (!row) {
      return null;
    }

    return {
      eventId: row.id,
      type: row.type,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      orderingKey: row.orderingKey,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  async listEventsForSync(
    userId: string,
    input: {
      sinceEventId?: string;
      sinceOccurredAt?: string;
      limit?: number;
      rooms?: string[];
    },
  ): Promise<DomainEventEnvelope[]> {
    const take = input.limit ?? 100;
    const userRoom = `user:${userId}`;
    const roomFilter = input.rooms?.filter((room) => room.length > 0) ?? [];
    const rooms = Array.from(new Set([userRoom, ...roomFilter]));

    let sinceOccurredAtDate: Date | undefined;
    let sinceEventId = input.sinceEventId;

    if (sinceEventId) {
      const cursorEvent = (await this.domainEventOutbox().findFirst({
        where: { id: sinceEventId },
        select: { id: true, occurredAt: true },
      })) as { id: string; occurredAt: Date } | null;

      if (!cursorEvent) {
        throw new BadRequestException({
          code: 'SYNC_EVENT_NOT_FOUND',
          message: 'sinceEventId was not found.',
        });
      }

      sinceOccurredAtDate = cursorEvent.occurredAt;
      sinceEventId = cursorEvent.id;
    } else if (input.sinceOccurredAt) {
      sinceOccurredAtDate = new Date(input.sinceOccurredAt);
      if (Number.isNaN(sinceOccurredAtDate.getTime())) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'sinceOccurredAt must be a valid ISO datetime.',
        });
      }
    }

    const where: Record<string, unknown> = {
      rooms: { hasSome: rooms },
    };

    if (sinceOccurredAtDate && sinceEventId) {
      where.OR = [
        {
          occurredAt: {
            gt: sinceOccurredAtDate,
          },
        },
        {
          occurredAt: sinceOccurredAtDate,
          id: {
            gt: sinceEventId,
          },
        },
      ];
    } else if (sinceOccurredAtDate) {
      where.occurredAt = { gt: sinceOccurredAtDate };
    }

    const rows = await this.domainEventOutbox().findMany({
      where,
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take,
    });

    return rows.map((row) => this.toEnvelope(row));
  }

  private toEnvelope(row: DomainEventOutboxRecord): DomainEventEnvelope {
    const occurredAtIso = row.occurredAt.toISOString();
    return {
      eventId: row.id,
      type: row.type,
      orderingValue: `${occurredAtIso}#${row.id}`,
      occurredAt: occurredAtIso,
      actorId: row.actorId,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      orderingKey: row.orderingKey,
      rooms: row.rooms,
      payload: row.payload,
    };
  }

  async listPendingOutboxEvents(limit = 50): Promise<DomainEventEnvelope[]> {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const rows = await this.domainEventOutbox().findMany({
      where: {
        publishedAt: null,
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: safeLimit,
    });

    return rows.map((row) => this.toEnvelope(row));
  }

  private resolveOrderingKey(input: CreateDomainEventInput): string {
    const key = input.orderingKey?.trim();
    if (key && key.length > 0) {
      return key;
    }

    return `${input.subjectType}:${input.subjectId}`;
  }

  private domainEventOutbox(): DomainEventOutboxDelegate {
    const delegate = (this.prisma as unknown as { domainEventOutbox?: DomainEventOutboxDelegate })
      .domainEventOutbox;

    if (!delegate) {
      throw new Error(
        'Prisma delegate "domainEventOutbox" is missing. Run "npm run prisma:generate", apply DB migration for DomainEventOutbox, then restart backend process.',
      );
    }

    return delegate;
  }
}
