export interface DomainEventEnvelope {
  eventId: string;
  type: string;
  orderingValue: string;
  occurredAt: string;
  actorId: string | null;
  subjectType: string;
  subjectId: string;
  orderingKey: string;
  rooms: string[];
  payload: unknown;
}

export interface CreateDomainEventInput {
  type: string;
  actorId?: string | null;
  subjectType: string;
  subjectId: string;
  orderingKey?: string;
  rooms: string[];
  payload: unknown;
}
