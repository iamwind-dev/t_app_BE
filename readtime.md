# Realtime Implementation Log

Tai lieu nay tong hop tat ca cac thay doi da duoc implement de hoan thien realtime cho backend.

## 1. Muc tieu da dat

- Phat domain event cho cac thay doi du lieu chinh.
- Ho tro phan phoi realtime qua Socket.IO theo room.
- Dam bao do tin cay bang transactional outbox + retry publisher.
- Ho tro replay/sync khi client reconnect.
- Chuan hoa contract event de FE patch state khong can refetch full.
- Them health/ops endpoint + metrics de van hanh production.

## 2. Domain Events + Envelope

Da chuan hoa envelope event:

- `eventId`
- `type`
- `occurredAt`
- `actorId`
- `subjectType`
- `subjectId`
- `orderingKey`
- `rooms`
- `payload`

`orderingKey` duoc dung cho per-entity ordering (mac dinh: `${subjectType}:${subjectId}`).

## 3. Transactional Outbox

Da them model outbox va migration:

- `DomainEventOutbox` trong `prisma/schema.prisma`
- migration: `prisma/migrations/20260521160000_domain_event_outbox/migration.sql`

Rule da ap dung:

- Ghi event vao outbox trong cung transaction voi data mutation.
- Emit realtime sau commit.
- Mark `publishedAt` khi publish thanh cong.

## 4. Event da duoc wire

Da emit event cho cac luong:

- `user.profile.updated`
- `post.created`, `post.updated`, `post.deleted`
- `reply.created`, `reply.updated`, `reply.deleted`
- `reaction.created`, `reaction.deleted`
- `follow.created`, `follow.deleted`
- `notification.created`

## 5. Realtime Gateway + Rooms

Da implement `RealtimeGateway` namespace:

- Namespace: `/realtime`
- JWT handshake qua `handshake.auth.token` hoac `Authorization: Bearer`
- Tra `auth_error` ro rang:
  - `AUTH_TOKEN_MISSING`
  - `AUTH_TOKEN_EXPIRED`
  - `AUTH_TOKEN_INVALID`
- Auto join personal room `user:{id}` sau auth thanh cong.
- Ho tro:
  - `subscribe_rooms`
  - `unsubscribe_rooms`

Room contract:

- `user:{id}`
- `feed:global`
- `thread:{id}`
- `chat:{conversationId}`

## 6. Chat Room Compatibility va Rollout

Da dual-room chat:

- `chat:{conversationId}` (moi)
- `conversation:{conversationId}` (legacy)

Da them co env:

- `CHAT_ENABLE_LEGACY_CONVERSATION_ROOM=true|false`

Rollout da chot:

- Staging: set `false` de test FE migrate.
- Production: chuyen `false` khi FE xac nhan migrate xong.

## 7. Sync API (Replay)

Da co endpoint:

- `GET /sync/events`

Ho tro cursor:

- `sinceEventId`
- `sinceOccurredAt`

Room filter:

- Tu dong include `user:{currentUserId}` + rooms FE request.

## 8. Outbox Publisher Retry + Health/Ops

Da implement background publisher:

- Quet event `publishedAt IS NULL` theo interval.
- Publish lai event loi (retry tick sau).

Da them runtime stats:

- `lastTickPendingCount`
- `lastTickProcessedCount`
- `totalPublishedSuccess`
- `totalPublishFail`
- `totalRetryCount`
- `lastTickAt`
- `lastTickDurationMs`
- `isRunning`

Da them endpoint ops:

- `GET /sync/outbox/stats`
- `GET /sync/outbox/pending?limit=...`
- `GET /sync/outbox/metrics` (Prometheus text format)

## 9. Bao ve endpoint ops

Da them guard noi bo:

- `src/common/guards/internal-ops.guard.ts`

Yeu cau truy cap `/sync/outbox/*`:

- JWT hop le
- Header `x-internal-token`
- match env `INTERNAL_OPS_TOKEN`

Neu khong set `INTERNAL_OPS_TOKEN`, endpoint ops bi disable mac dinh.

## 10. Prometheus Metrics da expose

Tu endpoint `GET /sync/outbox/metrics`:

- `outbox_pending_events`
- `outbox_published_success_total`
- `outbox_publish_fail_total`
- `outbox_retry_total`
- `outbox_last_tick_duration_ms`
- `outbox_last_tick_pending_count`
- `outbox_last_tick_processed_count`
- `outbox_publisher_running`

## 11. Tai lieu contract FE-BE

Da cap nhat:

- `docs/realtime-contract.md`

Noi dung da co:

- Room contract
- Event envelope
- Event types + payload toi thieu
- Replay/sync rules
- Reconnect rules
- FE idempotent + ordering rules
- Outbox reliability rules
- Ops endpoint access
- Suggested alert rules
- Done criteria reconnect FE-BE

## 12. Done Criteria da chot voi FE

FE bat buoc:

- Luu `lastEventId` ben vung (qua app restart).
- De-dup theo `eventId`.
- Ordering theo `orderingKey`.
- Flow reconnect:
  1. Nhan `AUTH_TOKEN_EXPIRED`
  2. `POST /auth/refresh`
  3. Reconnect `/realtime` voi access token moi
  4. Re-subscribe rooms
  5. `GET /sync/events?sinceEventId=<lastEventId>`
  6. Update `lastEventId` moi nhat sau khi apply event

## 13. Test da bo sung

### Unit/Spec

- `src/domain-events/realtime.gateway.spec.ts`
  - test `auth_error`
  - test `subscribe_rooms` / `unsubscribe_rooms`
  - test chan subscribe user room cua nguoi khac
- `src/domain-events/domain-events.controller.spec.ts`
  - test `GET /sync/events`
  - test `GET /sync/outbox/stats`
  - test `GET /sync/outbox/pending`
  - test `GET /sync/outbox/metrics`
- `src/domain-events/domain-events.service.spec.ts`
  - test outbox count/meta/pending list
- `src/chat/chat.gateway.spec.ts`
  - test room behavior khi tat legacy room

### E2E

- `test/realtime-reconnect.e2e-spec.ts`
  - mo phong flow:
    - WS `AUTH_TOKEN_EXPIRED`
    - `POST /auth/refresh`
    - `GET /sync/events?sinceEventId=...`
  - xac nhan event envelope contract de FE apply.

## 14. Bien moi truong da bo sung/cap nhat

Trong `.env.example`:

- `CHAT_ENABLE_LEGACY_CONVERSATION_ROOM=true`
- `INTERNAL_OPS_TOKEN=`

## 15. Ket qua verify

Da chay va pass:

- Test unit/spec cho domain events + gateway/controller
- Test e2e reconnect contract
- `npm run build`

## 16. Trang thai hien tai

Backend da san sang realtime cho cac luong chinh va co co che replay/reliability/ops.

De hoan tat end-to-end production:

- FE can implement day du done criteria (lastEventId, de-dup, ordering, reconnect+sync).
- Sau khi FE migrate room chat xong, tat legacy room o production.
