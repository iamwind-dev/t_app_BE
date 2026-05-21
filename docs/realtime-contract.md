# Realtime Contract (Socket.IO + Sync API)

This document defines the contract between FE and BE for realtime domain events.

## 1. Transport

- WebSocket namespace: `/realtime`
- Protocol: Socket.IO
- Sync API: `GET /sync/events`

## 2. Authentication

- Client sends JWT access token via:
  - `handshake.auth.token`, or
  - `Authorization: Bearer <token>`
- On connect failure:
  - `AUTH_TOKEN_MISSING`
  - `AUTH_TOKEN_EXPIRED`
  - `AUTH_TOKEN_INVALID`
- Refresh endpoint:
  - `POST /auth/refresh`

## 3. Room Contract

- Personal room: `user:{userId}`
- Global feed room: `feed:global`
- Thread room: `thread:{id}`
- Chat room: `chat:{conversationId}`
- Legacy chat room (temporary compatibility): `conversation:{conversationId}`
- Legacy room rollout:
  - Staging: set `CHAT_ENABLE_LEGACY_CONVERSATION_ROOM=false` to validate FE migration.
  - Production: switch to `false` only after FE confirms all clients use `chat:{conversationId}`.

Subscribe/unsubscribe events:

- `subscribe_rooms` payload:
```json
{ "rooms": ["feed:global", "thread:9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1"] }
```
- `unsubscribe_rooms` payload:
```json
{ "rooms": ["feed:global"] }
```

## 4. Event Envelope

All domain events must follow this shape:

```json
{
  "eventId": "uuid",
  "type": "user.profile.updated",
  "orderingValue": "2026-05-21T10:00:00.000Z#9f1d...",
  "occurredAt": "2026-05-21T10:00:00.000Z",
  "actorId": "uuid-or-null",
  "subjectType": "USER|POST|REPLY|FOLLOW|NOTIFICATION",
  "subjectId": "uuid",
  "orderingKey": "USER:7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
  "rooms": ["user:...","feed:global"],
  "payload": {}
}
```

Required fields:

- `eventId`, `type`, `orderingValue`, `occurredAt`, `subjectType`, `subjectId`, `orderingKey`, `rooms`, `payload`

Idempotency key:

- `eventId`

Ordering:

- Global replay ordering: `occurredAt ASC`, then `eventId ASC`
- Per-entity ordering: `orderingKey`
- Stable comparator field for FE: `orderingValue = <occurredAt ISO>#<eventId>`

Default `orderingKey`:

- `${subjectType}:${subjectId}`

## 5. Event Types

### user.profile.updated

- Rooms:
  - `user:{userId}`
  - `feed:global`
- Payload required fields:
  - `userId`
  - `displayName`
  - `avatarUrl`
  - `bio`
  - `updatedAt`
  - `version` (same value as `updatedAt` currently)

Example payload:
```json
{
  "userId": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
  "displayName": "New Name",
  "avatarUrl": "https://cdn.example.com/uploads/avatars/me.jpg",
  "bio": "Building mobile apps.",
  "updatedAt": "2026-05-21T10:10:00.000Z",
  "version": "2026-05-21T10:10:00.000Z"
}
```

### post.created / post.updated

- Rooms:
  - `feed:global`
  - `user:{actorId}`
  - `thread:{postId}`
- Payload required fields:
  - `post`

### post.deleted

- Rooms:
  - `feed:global`
  - `user:{actorId}`
  - `thread:{postId}`
- Payload required fields:
  - `id`
  - `deletedAt`

### reply.created / reply.updated

- Rooms:
  - `thread:{postId}`
  - `user:{actorId}`
- Payload required fields:
  - `reply`

### reply.deleted

- Rooms:
  - `thread:{postId}`
  - `user:{actorId}`
- Payload required fields:
  - `id`
  - `postId`
  - `deletedAt`

### reaction.created / reaction.deleted

- Rooms:
  - `thread:{targetId}`
  - `user:{actorId}`
  - optional recipient user room when applicable
- Payload required fields:
  - `targetType` (`POST` or `REPLY`)
  - `targetId`
  - `likeCount`
  - `isLiked`

### follow.created / follow.deleted

- Rooms:
  - `user:{followingId}`
  - `user:{followerId}`
- Payload required fields:
  - `followerId`
  - `followingId`

### notification.created

- Rooms:
  - `user:{recipientId}`
- Payload required fields:
  - `notification`

## 6. Sync / Replay Contract

Endpoint:

- `GET /sync/events?sinceEventId=<uuid>&sinceOccurredAt=<iso>&limit=<1..200>&rooms=<csv>`

Rules:

- If `sinceEventId` is provided and found:
  - server replays strictly after that event cursor.
- If `sinceEventId` is missing and `sinceOccurredAt` is provided:
  - server replays events with `occurredAt > sinceOccurredAt`.
- If both are missing:
  - server returns from the earliest matching events (bounded by `limit`).
- Server always includes personal room filtering (`user:{currentUserId}`) plus requested rooms.

Response:

```json
{
  "items": [/* DomainEventEnvelope[] */]
}
```

## 7. FE Reconnect Rules

On app start or reconnect:

1. Refresh token if access token expired (`POST /auth/refresh`).
2. Connect `/realtime` with new access token.
3. Re-subscribe rooms needed for current screens.
4. Call `GET /sync/events?sinceEventId=<lastEventId>` to backfill missed events.
5. Apply events with idempotent+ordering guards.
6. Update stored cursor to latest applied `eventId`.

## 8. FE Idempotent + Ordering Rules

- Keep `seenEventIds` (LRU set).
- Drop event if `eventId` already exists.
- Track `lastAppliedByOrderingKey[orderingKey] = { occurredAt, eventId }`.
- Apply only if event is newer than the last one for that key:
  - later `occurredAt`, or
  - same `occurredAt` and lexicographically larger `eventId`.

## Done Criteria (FE-BE Reconnect Contract)

This contract is considered done only when all checks below pass in staging:

- FE persists `lastEventId` locally and survives app restart.
- FE applies idempotency by `eventId` (duplicate event does not patch state twice).
- FE applies ordering by `orderingKey` (older event for same key is ignored).
- On socket `auth_error` with `AUTH_TOKEN_EXPIRED`, FE executes:
  1. `POST /auth/refresh`
  2. reconnect `/realtime` with new access token
  3. re-subscribe rooms
  4. `GET /sync/events?sinceEventId=<lastEventId>`
- FE updates stored `lastEventId` to the newest applied event after sync.
- BE integration check:
  - `test/realtime-reconnect.e2e-spec.ts` passes.

## 9. Outbox Reliability Rules

- Domain event is persisted to `DomainEventOutbox` in the same DB transaction as data mutation.
- Realtime emit happens after commit.
- Background outbox publisher retries events where `publishedAt IS NULL`.

## 10. Ops Endpoint Access

- Outbox ops endpoints:
  - `GET /sync/outbox/stats`
  - `GET /sync/outbox/pending?limit=20`
  - `GET /sync/outbox/metrics` (Prometheus text format)
- Access requirements:
  - Valid JWT access token (`Authorization: Bearer <access_token>`)
  - Internal header `x-internal-token: <INTERNAL_OPS_TOKEN>`
- If `INTERNAL_OPS_TOKEN` is missing on server, ops endpoints are disabled by default.

## 11. Suggested Alert Rules

- Backlog growth:
  - trigger warning if `outbox_pending_events` grows continuously for 5-10 minutes.
- Publish failure spike:
  - trigger warning if `increase(outbox_publish_fail_total[5m]) > 0`
  - trigger critical if failure rate is sustained (for example 3 consecutive windows).
- Tick latency abnormal:
  - trigger warning if `outbox_last_tick_duration_ms` is above baseline threshold (for example > 2000ms for 5m).
