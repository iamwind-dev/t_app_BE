# Chat Realtime 1-1 OpenSpec

## 1. Goal

The Chat module provides realtime 1-1 messaging for the NestJS backend:

- Create or get a direct conversation between the current user and another user.
- List the current user's conversations for the Flutter inbox.
- Get text message history for a conversation with cursor pagination.
- Allow conversation members to join a Socket.IO room, send text messages, send typing indicators, and mark messages as seen.
- Persist messages to PostgreSQL through Prisma before emitting realtime events.

The first phase supports text messages only. It does not support group chat,
media messages, message reactions, delete/edit message, per-device read
receipts, or AI moderation. Socket.IO must authenticate with JWT and every
read/write operation must verify membership.

## 2. REST APIs

All REST APIs in the Chat module are private and require JWT:

```http
Authorization: Bearer jwt.access.token
```

User id must come from the JWT payload, not from the request body.

### 2.1 POST /conversations/direct/:userId

Creates or gets a 1-1 conversation between the current user and target user.

#### Authentication

Private API. JWT guard is required.

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `userId` | string | yes | Valid UUID of the user to chat with |

#### Response 201

Returns a new conversation when none exists.

```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
      "type": "direct",
      "members": [
        {
          "user": {
            "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
            "username": "current_user",
            "displayName": "Current User",
            "avatarUrl": null
          },
          "joinedAt": "2026-04-24T14:00:00.000Z",
          "lastSeenMessageId": null,
          "lastSeenAt": null
        },
        {
          "user": {
            "id": "02d50f39-eef6-4edb-85c0-2dd8d020df3a",
            "username": "friend_user",
            "displayName": "Friend User",
            "avatarUrl": null
          },
          "joinedAt": "2026-04-24T14:00:00.000Z",
          "lastSeenMessageId": null,
          "lastSeenAt": null
        }
      ],
      "lastMessage": null,
      "unreadCount": 0,
      "createdAt": "2026-04-24T14:00:00.000Z",
      "updatedAt": "2026-04-24T14:00:00.000Z"
    }
  }
}
```

#### Response 200

Returns an existing conversation with the same response shape as `201 Created`.

### 2.2 GET /conversations

Lists conversations where the current user is a member.

#### Authentication

Private API. JWT guard is required.

#### Query Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `limit` | number | no | Items per page, default `20`, maximum `50` |
| `cursor` | string | no | Cursor of the last item on the previous page, preferably a conversation id or stable encoded cursor |

#### Response 200

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
        "type": "direct",
        "members": [
          {
            "user": {
              "id": "02d50f39-eef6-4edb-85c0-2dd8d020df3a",
              "username": "friend_user",
              "displayName": "Friend User",
              "avatarUrl": null
            },
            "joinedAt": "2026-04-24T14:00:00.000Z",
            "lastSeenMessageId": "d3a5b71a-56a0-41e0-b985-46d6b7f613c2",
            "lastSeenAt": "2026-04-24T14:05:00.000Z"
          }
        ],
        "lastMessage": {
          "id": "d3a5b71a-56a0-41e0-b985-46d6b7f613c2",
          "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
          "sender": {
            "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
            "username": "current_user",
            "displayName": "Current User",
            "avatarUrl": null
          },
          "type": "text",
          "text": "Hello!",
          "createdAt": "2026-04-24T14:04:00.000Z"
        },
        "unreadCount": 0,
        "createdAt": "2026-04-24T14:00:00.000Z",
        "updatedAt": "2026-04-24T14:04:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
      "hasNextPage": true
    }
  }
}
```

For inbox responses, `members` should return the other member of a direct
conversation. If full member lists are needed for debug/admin purposes, define a
separate API.

### 2.3 GET /conversations/:id/messages

Gets message history for a conversation.

#### Authentication

Private API. JWT guard and membership are required.

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | Valid conversation UUID |

#### Query Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `limit` | number | no | Items per page, default `30`, maximum `100` |
| `cursor` | string | no | Cursor of the last message on the previous page, preferably a message id or stable encoded cursor |

#### Response 200

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "d3a5b71a-56a0-41e0-b985-46d6b7f613c2",
        "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
        "sender": {
          "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
          "username": "current_user",
          "displayName": "Current User",
          "avatarUrl": null
        },
        "type": "text",
        "text": "Hello!",
        "createdAt": "2026-04-24T14:04:00.000Z",
        "updatedAt": "2026-04-24T14:04:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": "d3a5b71a-56a0-41e0-b985-46d6b7f613c2",
      "hasNextPage": true
    }
  }
}
```

Messages should be sorted by `createdAt DESC`, then `id DESC` when a tie-breaker
is needed. Flutter can reverse the order in the UI when it needs older messages
above newer messages.

## 3. Socket Events

The Socket gateway uses Socket.IO and must authenticate JWT during the
handshake.

Client can send the token by one of these conventions:

```json
{
  "auth": {
    "token": "jwt.access.token"
  }
}
```

or:

```http
Authorization: Bearer jwt.access.token
```

After authentication succeeds, the gateway assigns `socket.userId` from JWT
claim `sub`. Unauthenticated sockets must not join conversations, send
messages, send typing indicators, or mark messages as seen.

### 3.1 Client to Server

#### join_conversation

Client requests to join a conversation room.

- Membership: current user must be a conversation member.
- Suggested internal room name: `conversation:{conversationId}`.
- Ack: should use callback ack so Flutter knows whether join succeeded or failed.

#### send_message

Client sends a text message to a conversation.

- Membership: sender must be a conversation member.
- Persistence: service must save `Message` to PostgreSQL first.
- Emit: emit `new_message` only after transaction/database write succeeds.
- Broadcast: emit to room `conversation:{conversationId}`, including sender when the client needs to reconcile optimistic state.

#### typing

Client indicates typing state.

- Membership: current user must be a conversation member.
- Persistence: not stored in DB in the first phase.
- Broadcast: emit `user_typing` to other members in the room; no need to send back to sender.

#### mark_seen

Client marks messages seen up to a message.

- Membership: current user must be a conversation member.
- Message must belong to the conversation.
- Service updates `ConversationMember.lastSeenMessageId` and `lastSeenAt`.
- Emit `message_seen` to the room after the update succeeds.

### 3.2 Server to Client

#### new_message

Server emits this after a text message has been saved successfully.

#### user_typing

Server emits this when a conversation member is typing.

#### message_seen

Server emits this when a member has seen up to a message.

## 4. Request/Response/Event Payload

### 4.1 REST Request Samples

#### Create or get direct conversation

```http
POST /conversations/direct/02d50f39-eef6-4edb-85c0-2dd8d020df3a
Authorization: Bearer jwt.access.token
```

No request body.

#### List conversations

```http
GET /conversations?limit=20&cursor=3a50afcb-17a4-4d7c-8f58-c3d280467ba1
Authorization: Bearer jwt.access.token
```

#### Get messages

```http
GET /conversations/3a50afcb-17a4-4d7c-8f58-c3d280467ba1/messages?limit=30&cursor=d3a5b71a-56a0-41e0-b985-46d6b7f613c2
Authorization: Bearer jwt.access.token
```

### 4.2 Common Response Shapes

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": "CHAT_CONVERSATION_NOT_FOUND",
    "message": "Conversation not found."
  }
}
```

### 4.3 Socket Payloads

#### join_conversation payload

```json
{
  "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1"
}
```

#### join_conversation ack success

```json
{
  "success": true,
  "data": {
    "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
    "joined": true
  }
}
```

#### send_message payload

```json
{
  "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
  "clientMessageId": "local-1713967440000-1",
  "text": "Hello!"
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `conversationId` | string | yes | Valid UUID |
| `clientMessageId` | string | no | Client-generated id for optimistic message mapping, maximum 100 characters |
| `text` | string | yes | Trim, non-empty, maximum 2000 characters |

#### send_message ack success

```json
{
  "success": true,
  "data": {
    "clientMessageId": "local-1713967440000-1",
    "message": {
      "id": "d3a5b71a-56a0-41e0-b985-46d6b7f613c2",
      "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
      "sender": {
        "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
        "username": "current_user",
        "displayName": "Current User",
        "avatarUrl": null
      },
      "type": "text",
      "text": "Hello!",
      "createdAt": "2026-04-24T14:04:00.000Z",
      "updatedAt": "2026-04-24T14:04:00.000Z"
    }
  }
}
```

#### typing payload

```json
{
  "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
  "isTyping": true
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `conversationId` | string | yes | Valid UUID |
| `isTyping` | boolean | yes | `true` when typing, `false` when typing stops |

#### mark_seen payload

```json
{
  "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
  "messageId": "d3a5b71a-56a0-41e0-b985-46d6b7f613c2"
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `conversationId` | string | yes | Valid UUID |
| `messageId` | string | yes | Valid UUID, must belong to the conversation |

#### new_message event

```json
{
  "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
  "clientMessageId": "local-1713967440000-1",
  "message": {
    "id": "d3a5b71a-56a0-41e0-b985-46d6b7f613c2",
    "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
    "sender": {
      "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
      "username": "current_user",
      "displayName": "Current User",
      "avatarUrl": null
    },
    "type": "text",
    "text": "Hello!",
    "createdAt": "2026-04-24T14:04:00.000Z",
    "updatedAt": "2026-04-24T14:04:00.000Z"
  }
}
```

#### user_typing event

```json
{
  "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
  "user": {
    "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
    "username": "current_user",
    "displayName": "Current User",
    "avatarUrl": null
  },
  "isTyping": true,
  "occurredAt": "2026-04-24T14:04:02.000Z"
}
```

#### message_seen event

```json
{
  "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
  "userId": "02d50f39-eef6-4edb-85c0-2dd8d020df3a",
  "messageId": "d3a5b71a-56a0-41e0-b985-46d6b7f613c2",
  "seenAt": "2026-04-24T14:05:00.000Z"
}
```

#### Socket ack error

```json
{
  "success": false,
  "error": {
    "code": "CHAT_FORBIDDEN",
    "message": "You are not a member of this conversation."
  }
}
```

### 4.4 Database Models

#### Conversation

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | UUID | yes | Primary key |
| `type` | enum | yes | First phase only uses `direct` |
| `createdAt` | DateTime | yes | Set automatically on create |
| `updatedAt` | DateTime | yes | Updated when a new message or metadata change occurs |

Recommended indexes:

- `@@index([updatedAt])`

#### ConversationMember

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | UUID | yes | Primary key |
| `conversationId` | UUID | yes | Relation to `Conversation` |
| `userId` | UUID | yes | Relation to `User` |
| `joinedAt` | DateTime | yes | Join time |
| `lastSeenMessageId` | UUID nullable | no | Latest message seen by user |
| `lastSeenAt` | DateTime nullable | no | Latest seen time |
| `createdAt` | DateTime | yes | Set automatically on create |
| `updatedAt` | DateTime | yes | Updated when seen state changes |

Recommended constraints/indexes:

- `@@unique([conversationId, userId])`
- `@@index([userId, updatedAt])`
- `@@index([conversationId])`

#### Message

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | UUID | yes | Primary key |
| `conversationId` | UUID | yes | Relation to `Conversation` |
| `senderId` | UUID | yes | Relation to `User` |
| `type` | enum | yes | First phase only uses `text` |
| `text` | string | yes | Trimmed content |
| `createdAt` | DateTime | yes | Set automatically on create |
| `updatedAt` | DateTime | yes | Set automatically on create/update |

Recommended indexes:

- `@@index([conversationId, createdAt, id])`
- `@@index([senderId, createdAt])`

## 5. Business Rules

- The first phase of chat supports only direct 1-1 conversations and text messages.
- `POST /conversations/direct/:userId` creates a conversation if none exists, or returns the existing direct conversation for that user pair.
- Users cannot create a direct conversation with themselves.
- Target user must exist, be active, and not be soft deleted.
- Every direct conversation must have exactly two `ConversationMember` records.
- Service should use a transaction when creating a conversation and its two members.
- A stable uniqueness mechanism is required to prevent race conditions that create duplicate direct conversations for the same user pair. If the schema has no separate key table, catch unique constraint conflicts and re-query the existing conversation.
- Only conversation members may join the Socket.IO room.
- Only conversation members may send messages.
- Only conversation members may get message history.
- Only conversation members may send typing state or mark seen.
- Message must be saved to DB before `new_message` is emitted.
- When sending a message succeeds, service should update `Conversation.updatedAt` so inbox sorting follows latest activity.
- `send_message` accepts only trimmed, non-empty text.
- Server must not trust `senderId` from the client. Sender always comes from the JWT-authenticated socket.
- `mark_seen` only allows marking messages that belong to the conversation.
- `mark_seen` should not move `lastSeenAt` or `lastSeenMessageId` backward to an older message if the user already saw a newer message.
- `typing` is transient, is not stored in DB, and does not create notifications.
- REST and Socket responses must not return password hashes, refresh tokens, JWT metadata, private email, or security fields.
- Prisma access must go through the existing Prisma service.

## 6. Error Cases

REST error responses should use the shared shape:

```json
{
  "success": false,
  "error": {
    "code": "CHAT_FORBIDDEN",
    "message": "You are not a member of this conversation."
  }
}
```

| Case | HTTP Status / Socket | Error Code | Message |
| --- | --- | --- | --- |
| Missing REST bearer token | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired REST JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| Socket handshake missing token | disconnect / ack error | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Socket token invalid or expired | disconnect / ack error | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| `userId`, `conversationId`, or `messageId` is not a UUID | 400 / ack error | `VALIDATION_ERROR` | `Invalid id format.` |
| Target user missing, soft deleted, or disabled | 404 | `USER_NOT_FOUND` | `User not found.` |
| User creates conversation with self | 400 | `CHAT_CANNOT_MESSAGE_SELF` | `Cannot create a direct conversation with yourself.` |
| Conversation does not exist | 404 / ack error | `CHAT_CONVERSATION_NOT_FOUND` | `Conversation not found.` |
| User is not a conversation member | 403 / ack error | `CHAT_FORBIDDEN` | `You are not a member of this conversation.` |
| Invalid or out-of-range query `limit` | 400 | `VALIDATION_ERROR` | `Invalid pagination limit.` |
| Invalid query `cursor` format | 400 | `VALIDATION_ERROR` | `Invalid cursor.` |
| Text message empty after trim | 400 / ack error | `VALIDATION_ERROR` | `Message text cannot be empty.` |
| Text message exceeds 2000 characters | 400 / ack error | `VALIDATION_ERROR` | `Message text is too long.` |
| `mark_seen` message does not belong to conversation | 400 / ack error | `CHAT_MESSAGE_NOT_IN_CONVERSATION` | `Message does not belong to this conversation.` |
| Race condition creates duplicate direct conversation | 200/201 after retry | none | Service catches unique conflict and returns existing conversation |
| DB error while saving message | 500 / ack error | `CHAT_MESSAGE_CREATE_FAILED` | `Message could not be sent.` |

Socket errors should be returned through ack callback when the client provides
one. Without ack, gateway may emit a shared error event such as `socket_error`
according to the project's convention.

## 7. Test Cases

### POST /conversations/direct/:userId

- Creates a new direct conversation when current user and target user do not have one.
- Returns the existing conversation when the user pair already has one.
- Ensures a new conversation has exactly 2 members.
- Rejects missing JWT with status 401.
- Rejects invalid or expired JWT with status 401.
- Returns 400 when `userId` is not a UUID.
- Returns 400 when user creates a conversation with themselves.
- Returns 404 when target user does not exist, is soft deleted, or is disabled.
- Handles race conditions when two requests create the same direct conversation concurrently and does not create duplicates.

### GET /conversations

- Returns conversations for the current user.
- Does not return conversations where the current user is not a member.
- Sorts conversations by latest activity using `updatedAt DESC`.
- Returns correct `lastMessage` and `unreadCount` for each conversation.
- Uses default `limit` 20 when omitted.
- Limits `limit` to 50.
- Returns correct `pageInfo.nextCursor` and `pageInfo.hasNextPage` when more pages exist.
- Returns 400 when `limit` or `cursor` is invalid.
- Response does not contain `passwordHash`, refresh token, JWT metadata, or security fields.

### GET /conversations/:id/messages

- Returns message history when current user is a conversation member.
- Rejects non-member with status 403.
- Returns 404 when conversation does not exist.
- Returns 400 when `id` is not a UUID.
- Sorts messages by `createdAt DESC`, then `id DESC` when needed.
- Uses default `limit` 30 when omitted.
- Limits `limit` to 100.
- Returns correct `pageInfo.nextCursor` and `pageInfo.hasNextPage`.
- Returns only text messages in the first phase.

### Socket Authentication

- Connects to Socket.IO successfully with valid JWT.
- Rejects or disconnects sockets missing token.
- Rejects or disconnects sockets with invalid or expired token.
- Gateway assigns `socket.userId` from JWT claim `sub`.
- Socket must not trust `userId` from client payload.

### join_conversation

- Member joins conversation room successfully.
- Non-member is rejected with `CHAT_FORBIDDEN`.
- Missing conversation returns `CHAT_CONVERSATION_NOT_FOUND`.
- Invalid `conversationId` payload returns `VALIDATION_ERROR`.

### send_message

- Member sends text message successfully.
- Message is saved to DB before `new_message` is emitted.
- `new_message` is emitted to the conversation room after DB write succeeds.
- Ack success returns `clientMessageId` when the client sent one.
- `Conversation.updatedAt` is updated after sending a message.
- Non-member is rejected with `CHAT_FORBIDDEN`.
- Empty text after trim is rejected.
- Text longer than 2000 characters is rejected.
- If DB write fails, `new_message` is not emitted.

### typing

- Member emits `typing` and server broadcasts `user_typing` to other members in the room.
- `typing` is not stored in DB.
- Non-member is rejected with `CHAT_FORBIDDEN`.
- Invalid payload format is rejected with `VALIDATION_ERROR`.

### mark_seen

- Member marks a message as seen successfully.
- Service updates `ConversationMember.lastSeenMessageId` and `lastSeenAt`.
- Server emits `message_seen` after update succeeds.
- Rejects marking a message that does not belong to the conversation.
- Does not move seen state back to an older message if the user already saw a newer message.
- Non-member is rejected with `CHAT_FORBIDDEN`.

### Integration

- Conversations controller uses DTOs for params and query.
- Chat gateway uses DTOs or equivalent validation pipe for socket payloads.
- REST endpoints are protected by JWT guard.
- Socket gateway authenticates JWT during handshake.
- Chat service checks membership before every read/write operation.
- Prisma writes for creating conversations and sending messages use transactions when atomicity is required.
- E2E tests use Supertest for REST APIs and Socket.IO client for realtime events.
