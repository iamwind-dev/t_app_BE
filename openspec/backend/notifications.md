# Notifications Module OpenSpec

## 1. Goal

The Notifications module provides APIs for authenticated users to view and
manage their own notifications in the NestJS + Prisma backend:

- List notifications for the current user.
- Mark one notification as read.
- Mark all notifications for the current user as read.
- Store notification records in PostgreSQL when social or messaging events occur.

The first phase only needs to store notifications in the database. It does not
need push notification delivery, background workers, queues, or third-party
service integrations.

MVP notification types:

- `LIKE`
- `REPLY`
- `FOLLOW`
- `MESSAGE`

## 2. APIs

### 2.1 GET /notifications

Lists notifications for the authenticated user, newest first.

#### Authentication

Private API. JWT is required:

```http
Authorization: Bearer jwt.access.token
```

User id must come from the JWT, not from request body or query params.

#### Query Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `limit` | number | no | Items per page, default `20`, maximum `50` |
| `cursor` | string | no | Cursor of the last item on the previous page, preferably a notification id or stable encoded cursor |
| `unreadOnly` | boolean | no | If `true`, return only unread notifications |

#### Response 200

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6e78f9f5-1bb5-497f-96ec-4465c7fcd74a",
        "type": "LIKE",
        "recipientId": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
        "actor": {
          "id": "f67b01fd-97a5-441f-bb63-9550e5f5ef38",
          "username": "other_user",
          "displayName": "Other User",
          "avatarUrl": "https://cdn.example.com/avatars/other-user.png"
        },
        "target": {
          "type": "POST",
          "id": "83052a85-52f0-47f8-b94e-f1ca1c7f6903"
        },
        "message": "Other User liked your post.",
        "readAt": null,
        "createdAt": "2026-04-24T14:00:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": "6e78f9f5-1bb5-497f-96ec-4465c7fcd74a",
      "hasNextPage": true
    }
  }
}
```

### 2.2 PATCH /notifications/:id/read

Marks one notification owned by the current user as read.

#### Authentication

Private API. JWT is required.

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | Valid notification UUID |

#### Request Body

No request body.

#### Response 200

```json
{
  "success": true,
  "data": {
    "notification": {
      "id": "6e78f9f5-1bb5-497f-96ec-4465c7fcd74a",
      "type": "LIKE",
      "recipientId": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
      "actor": {
        "id": "f67b01fd-97a5-441f-bb63-9550e5f5ef38",
        "username": "other_user",
        "displayName": "Other User",
        "avatarUrl": "https://cdn.example.com/avatars/other-user.png"
      },
      "target": {
        "type": "POST",
        "id": "83052a85-52f0-47f8-b94e-f1ca1c7f6903"
      },
      "message": "Other User liked your post.",
      "readAt": "2026-04-24T15:00:00.000Z",
      "createdAt": "2026-04-24T14:00:00.000Z"
    }
  }
}
```

If the notification was already read, the API still returns 200 and keeps the
existing `readAt` or updates it according to the service convention. Prefer
keeping the first `readAt` for idempotent behavior.

### 2.3 PATCH /notifications/read-all

Marks all unread notifications for the current user as read.

#### Authentication

Private API. JWT is required.

#### Request Body

No request body.

#### Response 200

```json
{
  "success": true,
  "data": {
    "updatedCount": 12
  }
}
```

`updatedCount` is the number of current-user notifications changed from unread
to read in this request.

## 3. Notification Payload

Notification records need a stable shape for the Flutter client:

```json
{
  "id": "6e78f9f5-1bb5-497f-96ec-4465c7fcd74a",
  "type": "LIKE",
  "recipientId": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
  "actorId": "f67b01fd-97a5-441f-bb63-9550e5f5ef38",
  "targetType": "POST",
  "targetId": "83052a85-52f0-47f8-b94e-f1ca1c7f6903",
  "message": "Other User liked your post.",
  "metadata": {
    "postPreview": "Hello from Threads-like app."
  },
  "readAt": null,
  "createdAt": "2026-04-24T14:00:00.000Z",
  "updatedAt": "2026-04-24T14:00:00.000Z"
}
```

### Fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | Notification UUID |
| `type` | enum | yes | One of `LIKE`, `REPLY`, `FOLLOW`, `MESSAGE` |
| `recipientId` | string | yes | User receiving the notification |
| `actorId` | string | no | User who created the event, nullable for future system events |
| `targetType` | string | no | Related resource type, such as `POST`, `REPLY`, `USER`, `MESSAGE`, `CONVERSATION` |
| `targetId` | string | no | Related resource id |
| `message` | string | yes | Short text for client display |
| `metadata` | object | no | Small JSON object, must not contain sensitive data |
| `readAt` | string/null | yes | `null` when unread, ISO timestamp when read |
| `createdAt` | string | yes | ISO timestamp |
| `updatedAt` | string | yes | ISO timestamp |

### Type Semantics

| Type | Trigger | Expected Target |
| --- | --- | --- |
| `LIKE` | A user likes the recipient's post or reply | `POST` or `REPLY` |
| `REPLY` | A user replies to the recipient's post or reply | `POST` or `REPLY` |
| `FOLLOW` | A user follows the recipient | `USER` |
| `MESSAGE` | A new message is sent in the recipient's conversation | `MESSAGE` or `CONVERSATION` |

API responses may enrich `actor` with public fields for display, but must not
return email, `passwordHash`, token metadata, or internal security fields.

## 4. Business Rules

- A notification must belong to exactly one recipient user through `recipientId`.
- All Notifications APIs are private and must use a JWT guard.
- Users may only view and update notifications where `recipientId` equals the user id in the JWT.
- Do not trust `recipientId` from request body, query params, or client input for protected APIs.
- `GET /notifications` returns only notifications for the current user.
- `GET /notifications` must use cursor pagination, default `limit = 20`, maximum `50`.
- Notifications should be sorted stably by `createdAt DESC`, then `id DESC` when a tie-breaker is needed.
- `PATCH /notifications/:id/read` can only mark the current user's notification.
- `PATCH /notifications/read-all` updates only unread notifications for the current user.
- Read state is represented by `readAt`: `null` means unread, timestamp means read.
- Mark-read operations should be idempotent. Calling them again for a read notification must not error.
- After like, reply, follow, or message succeeds, the corresponding service may create a notification record after the primary event has been persisted.
- Do not create notifications for a user's action on their own resource, such as liking their own post, replying to their own post, invalid self-follow, or a message from the recipient themselves when conversation logic does not require it.
- Avoid duplicate notifications for the same event when the event source has a stable id. Use a unique constraint or service logic with `sourceType` and `sourceId` when needed.
- First phase stores database records only. Do not send push notification, email, SMS, queue jobs, or call external providers.
- If a future Socket.IO notification event is added, emit only after persistence succeeds. That is outside the required scope of this spec.
- Prisma access must go through the existing Prisma service.
- Controllers only handle routing, DTO validation, and auth context; business rules belong in the Notifications service.

## 5. Error Cases

Error responses should use the shared shape:

```json
{
  "success": false,
  "error": {
    "code": "NOTIFICATION_NOT_FOUND",
    "message": "Notification not found."
  }
}
```

| Case | HTTP Status | Error Code | Message |
| --- | --- | --- | --- |
| Missing bearer token | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| `id` is not a valid UUID | 400 | `VALIDATION_ERROR` | `Invalid notification id.` |
| Invalid or out-of-range query `limit` | 400 | `VALIDATION_ERROR` | `Invalid pagination limit.` |
| Invalid query `cursor` format | 400 | `VALIDATION_ERROR` | `Invalid cursor.` |
| Query `unreadOnly` cannot be parsed as boolean | 400 | `VALIDATION_ERROR` | `Invalid unreadOnly value.` |
| Notification does not exist | 404 | `NOTIFICATION_NOT_FOUND` | `Notification not found.` |
| Notification belongs to another user | 404 | `NOTIFICATION_NOT_FOUND` | `Notification not found.` |
| Invalid notification type during internal creation | 400 | `VALIDATION_ERROR` | `Invalid notification type.` |
| Metadata is too large or contains unsupported fields | 400 | `VALIDATION_ERROR` | `Invalid notification metadata.` |

APIs should not reveal whether a notification id exists but belongs to another
user. That case returns the same `NOTIFICATION_NOT_FOUND` error.

## 6. Test Cases

### GET /notifications

- Returns the current user's notifications with a valid JWT.
- Returns only notifications where `recipientId` equals the user id from JWT.
- Does not return notifications from other users.
- Sorts notifications by `createdAt DESC`.
- Uses default `limit` 20 when omitted.
- Limits `limit` to 50.
- Returns correct `pageInfo.nextCursor` and `pageInfo.hasNextPage` when more pages exist.
- Filters only unread notifications when `unreadOnly=true`.
- Response includes `type`, `actor`, `target`, `message`, `readAt`, and `createdAt` in the correct shape.
- Response does not contain private email, `passwordHash`, token metadata, or internal security fields.
- Rejects missing JWT with status 401.
- Rejects invalid or expired token with status 401.
- Returns 400 when `limit`, `cursor`, or `unreadOnly` is invalid.

### PATCH /notifications/:id/read

- Marks the current user's notification as read successfully.
- Sets `readAt` when the notification is unread.
- Calling again for an already read notification still returns 200 and does not error.
- Does not allow a user to mark another user's notification as read.
- Returns 404 when notification does not exist.
- Returns 404 when notification exists but belongs to another user.
- Returns 400 when `id` is not a UUID.
- Rejects missing JWT with status 401.
- Rejects invalid or expired token with status 401.

### PATCH /notifications/read-all

- Marks all unread notifications for the current user as read.
- Updates only notifications where `recipientId` equals the user id from JWT.
- Does not update notifications belonging to other users.
- Returns `updatedCount` equal to the number of notifications updated in the request.
- Returns `updatedCount = 0` when the user has no unread notifications.
- Rejects missing JWT with status 401.
- Rejects invalid or expired token with status 401.

### Notification Creation

- Creates `LIKE` notification after a user successfully likes another user's post or reply.
- Creates `REPLY` notification after a user replies to another user's content.
- Creates `FOLLOW` notification after a user follows another user.
- Creates `MESSAGE` notification after a message is persisted for a recipient.
- Does not create notifications for a user's actions on their own resource unless business rules require it.
- Does not create duplicate notifications for the same event source when a stable source id exists.
- Does not call push notification, queue, email, SMS, or external provider in the MVP.

### Integration

- Notifications controller uses DTOs for params and query.
- All Notifications endpoints are protected by JWT guard.
- Notifications service gets the authenticated user id from request context/JWT, not from the body.
- Prisma query selects only returnable fields and enriches actor using public profile fields.
- E2E tests use Supertest for `GET /notifications`, `PATCH /notifications/:id/read`, and `PATCH /notifications/read-all`.
