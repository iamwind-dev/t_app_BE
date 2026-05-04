# Flutter API Integration Guide

Base URL local:

```text
http://localhost:3000
```

REST responses are wrapped globally:

```json
{
  "success": true,
  "data": {}
}
```

Error response shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request."
  }
}
```

Private APIs require:

```http
Authorization: Bearer <accessToken>
```

## Login Flow

1. Call `POST /auth/login`.
2. Store `accessToken` in secure storage, for example `flutter_secure_storage`.
3. Attach token to private REST requests with `Authorization: Bearer <token>`.
4. Attach token to Socket.IO connection with `auth: { token: accessToken }`.
5. If API returns `401`, clear token and navigate to login.

## Auth

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `POST` | `/auth/register` | No | `{ "email": "a@b.com", "username": "alice", "password": "Pass1234", "displayName": "Alice" }` | `{ "user": { "id": "...", "email": "...", "username": "alice" }, "accessToken": "..." }` |
| `POST` | `/auth/login` | No | `{ "identifier": "alice", "password": "Pass1234" }` | `{ "user": { "id": "...", "username": "alice" }, "accessToken": "..." }` |
| `GET` | `/auth/me` | Yes | None | `{ "id": "...", "email": "...", "username": "alice" }` |

## Users

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `GET` | `/users/:id` | Optional | None | `{ "user": { "id": "...", "username": "alice", "followersCount": 1, "followingCount": 2, "isFollowing": false } }` |
| `GET` | `/users/username/:username` | Optional | None | Same profile shape |
| `PATCH` | `/users/me` | Yes | `{ "displayName": "Alice A", "bio": "Hello", "avatarUrl": "https://..." }` | `{ "user": { "...": "updatedProfile" } }` |
| `GET` | `/users/:id/posts?limit=20&cursor=<postId>` | No | None | `{ "items": [{ "id": "...", "content": "...", "author": {} }], "pageInfo": {} }` |

## Posts

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `POST` | `/posts` | Yes | `{ "content": "Hello", "mediaUrls": [] }` | `{ "post": { "id": "...", "content": "Hello", "likeCount": 0, "replyCount": 0, "isLikedByMe": false } }` |
| `GET` | `/posts/feed?limit=20&cursor=<postId>` | Yes | None | `{ "items": [{ "id": "...", "author": {} }], "pageInfo": {} }` |
| `GET` | `/posts/:id` | Yes | None | `{ "post": { "id": "...", "author": {}, "isLikedByMe": true } }` |
| `PATCH` | `/posts/:id` | Yes | `{ "content": "Updated", "mediaUrls": [] }` | `{ "post": { "...": "updatedPost" } }` |
| `DELETE` | `/posts/:id` | Yes | None | `{ "deleted": true, "id": "...", "deletedAt": "2026-04-24T..." }` |

## Replies

Status: planned by OpenSpec. Current codebase has Prisma schema and reply reactions, but the Replies REST module is not implemented yet.

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `POST` | `/posts/:postId/replies` | Yes | `{ "content": "Reply", "mediaUrls": [] }` | `{ "reply": { "id": "...", "postId": "...", "parentReplyId": null, "childReplyCount": 0 } }` |
| `POST` | `/replies/:replyId/replies` | Yes | `{ "content": "Child reply", "mediaUrls": [] }` | `{ "reply": { "parentReplyId": "..." } }` |
| `GET` | `/posts/:postId/replies?limit=20&cursor=<replyId>` | Optional | None | `{ "items": [{ "id": "...", "childReplyCount": 2 }], "pageInfo": {} }` |
| `GET` | `/replies/:replyId/children?limit=10` | Optional | None | `{ "parentReplyId": "...", "items": [], "pageInfo": {} }` |
| `GET` | `/replies/:replyId/thread` | Optional | None | `{ "postId": "...", "ancestors": [], "reply": {}, "children": {} }` |
| `DELETE` | `/replies/:replyId` | Yes | None | `{ "id": "...", "deletedAt": "..." }` |

## Reactions

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `POST` | `/posts/:postId/like` | Yes | None | `{ "postId": "...", "likeCount": 12, "isLiked": true }` |
| `DELETE` | `/posts/:postId/like` | Yes | None | `{ "postId": "...", "likeCount": 11, "isLiked": false }` |
| `POST` | `/replies/:replyId/like` | Yes | None | `{ "replyId": "...", "likeCount": 5, "isLiked": true }` |
| `DELETE` | `/replies/:replyId/like` | Yes | None | `{ "replyId": "...", "likeCount": 4, "isLiked": false }` |

## Follows

Status: planned by OpenSpec. Current codebase has Prisma schema, but the Follows REST module is not implemented yet.

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `POST` | `/users/:userId/follow` | Yes | None | `{ "profile": { "id": "...", "followersCount": 16, "isFollowing": true } }` |
| `DELETE` | `/users/:userId/follow` | Yes | None | `{ "profile": { "id": "...", "isFollowing": false } }` |
| `GET` | `/users/:userId/followers?limit=20&cursor=<cursor>` | Optional | None | `{ "items": [{ "id": "...", "followedAt": "..." }], "pageInfo": {} }` |
| `GET` | `/users/:userId/following?limit=20&cursor=<cursor>` | Optional | None | Same paginated profile list |

## Conversations And Messages

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `POST` | `/conversations/direct/:userId` | Yes | None | `{ "conversation": { "id": "...", "type": "direct", "members": [], "lastMessage": null, "unreadCount": 0 } }` |
| `GET` | `/conversations?limit=20&cursor=<conversationId>` | Yes | None | `{ "items": [{ "id": "...", "members": [], "lastMessage": {}, "unreadCount": 1 }], "pageInfo": {} }` |
| `GET` | `/conversations/:id/messages?limit=30&cursor=<messageId>` | Yes | None | `{ "items": [{ "id": "...", "text": "Hello", "sender": {} }], "pageInfo": {} }` |

## Socket.IO Chat

Flutter connection example:

```dart
IO.io(
  baseUrl,
  IO.OptionBuilder()
    .setTransports(['websocket'])
    .setAuth({'token': accessToken})
    .build(),
);
```

| Event | Direction | Payload | Ack or event response |
|---|---|---|---|
| `join_conversation` | Client to Server | `{ "conversationId": "..." }` | `{ "success": true, "data": { "conversationId": "...", "joined": true } }` |
| `send_message` | Client to Server | `{ "conversationId": "...", "clientMessageId": "local-1", "text": "Hello" }` | `{ "success": true, "data": { "clientMessageId": "local-1", "message": {} } }` |
| `typing` | Client to Server | `{ "conversationId": "...", "isTyping": true }` | Broadcasts `user_typing` to other members |
| `mark_seen` | Client to Server | `{ "conversationId": "...", "messageId": "..." }` | Broadcasts `message_seen` |
| `new_message` | Server to Client | `{ "conversationId": "...", "clientMessageId": "...", "message": {} }` | Insert or update local message |
| `user_typing` | Server to Client | `{ "conversationId": "...", "userId": "...", "isTyping": true, "occurredAt": "..." }` | Show typing indicator |
| `message_seen` | Server to Client | `{ "conversationId": "...", "userId": "...", "messageId": "...", "seenAt": "..." }` | Update read state |

Socket error sample:

```json
{
  "success": false,
  "error": {
    "code": "CHAT_FORBIDDEN",
    "message": "You are not a member of this conversation."
  }
}
```

## Notifications

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `GET` | `/notifications?limit=20&cursor=<notificationId>&unreadOnly=true` | Yes | None | `{ "items": [{ "id": "...", "type": "LIKE", "actor": {}, "target": {}, "readAt": null }], "pageInfo": {} }` |
| `PATCH` | `/notifications/:id/read` | Yes | None | `{ "notification": { "id": "...", "readAt": "2026-04-24T..." } }` |
| `PATCH` | `/notifications/read-all` | Yes | None | `{ "updatedCount": 12 }` |

## Uploads

| Method | URL | Auth | Request body | Response sample |
|---|---|---:|---|---|
| `POST` | `/uploads/image` | Yes | `multipart/form-data`: `file`, `type=post|reply|profile_avatar` | `{ "upload": { "secureUrl": "https://...", "publicId": "uploads/posts/...", "type": "post" } }` |

Flutter upload notes:

- Use multipart request.
- Allowed mime types: `image/jpeg`, `image/png`, `image/webp`.
- Max file size: `5MB`.
- Use returned `secureUrl` in post, reply, or avatar APIs.

## Moderation Placeholder

No AI moderation API is exposed yet.

Client-facing behavior:

- Posts and replies include `moderationStatus`.
- Do not expect `moderationScore` or `moderationReason` in normal feed/detail responses.
- Client should be ready to hide or visually handle content if a future API returns `rejected` or `flagged`.

Example:

```json
{
  "moderationStatus": "approved"
}
```

## Pagination

Cursor pagination pattern:

```http
GET /posts/feed?limit=20
GET /posts/feed?limit=20&cursor=<nextCursor>
```

Response:

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": "last-item-id",
    "hasNextPage": true
  }
}
```

Flutter usage:

1. First load: call endpoint with `limit`.
2. Store `pageInfo.nextCursor`.
3. If `hasNextPage=true`, request next page with `cursor=nextCursor`.
4. Append items to local list.
5. Stop when `hasNextPage=false`.

## Common Error Examples

Unauthorized:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "Unauthorized"
  }
}
```

Validation:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Limit must be between 1 and 50."
  }
}
```

Not found:

```json
{
  "success": false,
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "Post was not found."
  }
}
```
