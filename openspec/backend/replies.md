# Replies Module OpenSpec

## 1. Goal

The Replies module provides Threads-style reply flows for posts and replies:

- Create a direct reply to a post.
- Create a child reply under another reply.
- List first-level replies for a post.
- List child replies for a parent reply so the UI can lazy-load the "Show replies" action.
- Get the thread context for a reply to open a conversation detail screen.
- Soft delete replies with `deletedAt`.

The module must use NestJS, Prisma, PostgreSQL, and JWT authentication. Do not
integrate AI moderation in the first phase; only store placeholder fields:

- `moderationStatus`
- `moderationScore`
- `moderationReason`

Reply responses must be stable for the Flutter client and must not expose Prisma
models directly.

## 2. Reply Tree Model

A reply is content that belongs to a post. Every reply has `postId`.

### 2.1 Data Shape

```ts
Reply {
  id: string;
  postId: string;
  parentReplyId: string | null;
  authorId: string;
  content: string;
  mediaUrls: string[];
  likeCount: number;
  childReplyCount: number;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationScore: number | null;
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

### 2.2 Tree Rules

- A direct reply to a post has `parentReplyId = null`.
- A reply to another reply has `parentReplyId = id` of the parent reply.
- Child replies must use the same `postId` as their parent reply.
- `POST /replies/:replyId/replies` must not accept `postId` from the body; the service gets `postId` from the parent reply.
- List APIs do not expand the whole reply tree by default.
- `GET /posts/:postId/replies` returns only top-level replies for the post.
- `GET /replies/:replyId/children` returns one page of direct child replies for `replyId`.
- `childReplyCount` is the count of direct child replies that are not soft deleted.
- Soft-deleted replies stay in the database to preserve history, notifications, moderation, reactions, and thread context.
- Default read queries exclude replies where `deletedAt != null`, unless a tombstone is explicitly required for thread context.

### 2.3 Reply Response Shape

All APIs that return reply items must use this shape:

```json
{
  "id": "b8fd27f6-80a4-4e58-8f86-0d6f020d8c54",
  "postId": "8d0b7d66-3d5a-41b6-80f7-3180f5b2178a",
  "parentReplyId": null,
  "content": "I agree with this.",
  "mediaUrls": [],
  "moderationStatus": "pending",
  "createdAt": "2026-04-24T14:30:00.000Z",
  "author": {
    "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
    "username": "user_name",
    "displayName": "User Name",
    "avatarUrl": null
  },
  "likeCount": 0,
  "childReplyCount": 2,
  "isLikedByMe": false
}
```

`moderationScore` and `moderationReason` are stored in the database but are not
required in list responses unless the current UI needs them. Future detail,
admin, or moderation APIs may expose them separately.

## 3. APIs

### 3.1 POST /posts/:postId/replies

Creates a first-level reply directly under a post.

#### Authentication

Private API. JWT is required.

```http
Authorization: Bearer jwt.access.token
```

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `postId` | string | yes | Valid UUID, post must exist and must not be soft deleted |

#### Request Body

```json
{
  "content": "This is a direct reply to the post.",
  "mediaUrls": []
}
```

#### Request Fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `content` | string | yes | Trim, non-empty when `mediaUrls` is empty, maximum based on product limit |
| `mediaUrls` | string[] | no | List of media URLs uploaded/validated by the upload flow, default `[]` |

#### Response 201

Returns the created reply using the standard reply response shape.

### 3.2 POST /replies/:replyId/replies

Creates a child reply under another reply.

#### Authentication

Private API. JWT is required.

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `replyId` | string | yes | Valid UUID, parent reply must exist and must not be soft deleted |

#### Request Body

```json
{
  "content": "This is a child reply.",
  "mediaUrls": [
    "https://cdn.example.com/uploads/reply-image.png"
  ]
}
```

#### Response 201

Returns the created child reply using the standard reply response shape.

When child reply creation succeeds, the service must increment the parent
reply's `childReplyCount` in the same transaction as the reply creation.

### 3.3 GET /posts/:postId/replies

Lists top-level replies for a post. This endpoint supports the post detail
screen and does not return the full reply tree.

#### Authentication

Public or optional JWT. If a valid JWT is provided, `isLikedByMe` is calculated
for the current user. Without JWT, `isLikedByMe = false`.

#### Query Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `cursor` | string | no | Reply id or encoded cursor of the last item on the previous page |
| `limit` | number | no | Default 20, maximum 50 |
| `sort` | string | no | `newest` or `oldest`, default `oldest` for conversation flow |

#### Response 200

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "b8fd27f6-80a4-4e58-8f86-0d6f020d8c54",
        "postId": "8d0b7d66-3d5a-41b6-80f7-3180f5b2178a",
        "parentReplyId": null,
        "content": "This is a direct reply to the post.",
        "mediaUrls": [],
        "moderationStatus": "pending",
        "createdAt": "2026-04-24T14:30:00.000Z",
        "author": {
          "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
          "username": "user_name",
          "displayName": "User Name",
          "avatarUrl": null
        },
        "likeCount": 4,
        "childReplyCount": 2,
        "isLikedByMe": true
      }
    ],
    "pageInfo": {
      "nextCursor": "b8fd27f6-80a4-4e58-8f86-0d6f020d8c54",
      "hasNextPage": true,
      "limit": 20
    }
  }
}
```

If `childReplyCount > 0`, Flutter can show a "Show replies" button and call
`GET /replies/:replyId/children`.

### 3.4 GET /replies/:replyId/children

Lists direct child replies for one parent reply. This endpoint supports the
"Show replies" UI.

#### Authentication

Public or optional JWT. If a valid JWT is provided, `isLikedByMe` is calculated
for the current user.

#### Query Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `cursor` | string | no | Reply id or encoded cursor of the last child on the previous page |
| `limit` | number | no | Default 10, maximum 50 |
| `sort` | string | no | `oldest` or `newest`, default `oldest` |

#### Response 200

```json
{
  "success": true,
  "data": {
    "parentReplyId": "b8fd27f6-80a4-4e58-8f86-0d6f020d8c54",
    "items": [],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false,
      "limit": 10
    }
  }
}
```

This endpoint returns only direct children, not grandchildren. If a child item
has `childReplyCount > 0`, the client calls the same endpoint with that child's
`replyId`.

### 3.5 GET /replies/:replyId/thread

Gets context for opening a thread detail screen for a specific reply.

#### Authentication

Public or optional JWT. If a valid JWT is provided, `isLikedByMe` is calculated
for the current user.

#### Query Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `childrenLimit` | number | no | Number of first direct children for the target reply, default 10, maximum 50 |
| `childrenCursor` | string | no | Cursor for child replies of the target reply |

#### Response 200

```json
{
  "success": true,
  "data": {
    "postId": "8d0b7d66-3d5a-41b6-80f7-3180f5b2178a",
    "ancestors": [],
    "reply": {
      "id": "5a9ab6ce-6d5c-4e5a-aef0-3f2db86e0b4e",
      "postId": "8d0b7d66-3d5a-41b6-80f7-3180f5b2178a",
      "parentReplyId": "b8fd27f6-80a4-4e58-8f86-0d6f020d8c54",
      "content": "This is the focused reply.",
      "mediaUrls": [],
      "moderationStatus": "pending",
      "createdAt": "2026-04-24T14:35:00.000Z",
      "author": {
        "id": "3ff9938d-1bd4-4f4c-bbc2-d1be0f7f0f8c",
        "username": "another_user",
        "displayName": "Another User",
        "avatarUrl": null
      },
      "likeCount": 1,
      "childReplyCount": 3,
      "isLikedByMe": false
    },
    "children": {
      "items": [],
      "pageInfo": {
        "nextCursor": null,
        "hasNextPage": false,
        "limit": 10
      }
    }
  }
}
```

`ancestors` are sorted from the reply closest to the post to the direct parent
of the target reply. This API returns only the ancestor path and one page of
direct children for the target reply, not the full subtree.

### 3.6 DELETE /replies/:replyId

Soft deletes a reply owned by the current user.

#### Authentication

Private API. JWT is required.

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `replyId` | string | yes | Valid UUID, reply must exist |

#### Response 200

```json
{
  "success": true,
  "data": {
    "id": "5a9ab6ce-6d5c-4e5a-aef0-3f2db86e0b4e",
    "deletedAt": "2026-04-24T15:00:00.000Z"
  }
}
```

Delete must not hard delete the record, delete children, or delete reaction
records. If the deleted reply is a child reply, the service must decrement the
parent reply's `childReplyCount` in the same transaction.

## 4. Request/Response Samples

### 4.1 Create Top-Level Reply

```http
POST /posts/8d0b7d66-3d5a-41b6-80f7-3180f5b2178a/replies
Authorization: Bearer jwt.access.token
Content-Type: application/json
```

```json
{
  "content": "Great point.",
  "mediaUrls": []
}
```

Response returns the created reply in the standard reply response shape.

### 4.2 Show Replies Button Flow

Post detail loads top-level replies:

```http
GET /posts/8d0b7d66-3d5a-41b6-80f7-3180f5b2178a/replies?limit=20
```

If an item has:

```json
{
  "id": "b8fd27f6-80a4-4e58-8f86-0d6f020d8c54",
  "childReplyCount": 2
}
```

Flutter shows "Show replies" and calls:

```http
GET /replies/b8fd27f6-80a4-4e58-8f86-0d6f020d8c54/children?limit=10
```

The response includes only direct children for that parent.

## 5. Business Rules

- Create and delete APIs must use a JWT guard.
- Read APIs may be public, but should support optional JWT to calculate `isLikedByMe`.
- Authenticated user id must come from JWT, never from the request body.
- `content` must be trimmed before validation and persistence.
- A reply must have non-empty `content` or at least one valid `mediaUrls` item.
- `mediaUrls` must reference media already accepted by the upload flow when the Uploads module is available.
- Top-level reply creation sets `parentReplyId = null`.
- Child reply creation sets `parentReplyId` to the parent reply id and copies `postId` from the parent reply.
- Service must reject child reply creation when the parent reply is soft deleted.
- Service must reject top-level reply creation when the target post is soft deleted.
- `moderationStatus` defaults to `pending` or the project-approved initial status.
- `moderationScore` defaults to `null`.
- `moderationReason` defaults to `null`.
- No external AI provider, queue, worker, model call, or automated moderation pipeline is allowed in this phase.
- `likeCount` is maintained by the Reactions module and exposed as a denormalized count.
- `childReplyCount` is maintained when direct child replies are created or soft deleted.
- Use database transactions when reply creation/deletion and count updates must succeed or fail together.
- Default read queries exclude `deletedAt != null`.
- Delete is idempotent only if the product chooses that behavior; otherwise deleting an already deleted reply returns 404.
- Users may only delete replies they authored unless a future role-based moderation rule explicitly allows otherwise.
- Controllers stay thin; validation belongs in DTOs and business rules belong in `RepliesService`.

## 6. Pagination Rules

- List endpoints must use cursor pagination, not offset pagination.
- `GET /posts/:postId/replies` paginates top-level replies where `parentReplyId = null`.
- `GET /replies/:replyId/children` paginates direct children where `parentReplyId = :replyId`.
- `GET /replies/:replyId/thread` may paginate only direct children of the focused reply.
- Default limits: post replies 20, child replies 10, thread children 10.
- Maximum `limit` is 50.
- Invalid `limit`, negative `limit`, non-numeric `limit`, malformed `cursor`, or unsupported `sort` must return a validation error.
- Cursor should be stable across mobile refreshes. Recommended cursor fields are `createdAt` plus `id`.
- Sorting must be deterministic:
  - `oldest`: `createdAt ASC`, `id ASC`.
  - `newest`: `createdAt DESC`, `id DESC`.
- Responses must include `pageInfo.nextCursor`, `pageInfo.hasNextPage`, and `pageInfo.limit`.

## 7. Error Cases

Error responses should use the shared shape:

```json
{
  "success": false,
  "error": {
    "code": "REPLY_NOT_FOUND",
    "message": "Reply not found."
  }
}
```

| Case | HTTP Status | Error Code | Message |
| --- | --- | --- | --- |
| Missing JWT on create/delete | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| Invalid `postId` format | 400 | `VALIDATION_ERROR` | `Post id must be valid.` |
| Invalid `replyId` format | 400 | `VALIDATION_ERROR` | `Reply id must be valid.` |
| Request body missing content and media | 400 | `VALIDATION_ERROR` | `Reply content or media is required.` |
| Content too long | 400 | `VALIDATION_ERROR` | `Reply content is too long.` |
| Invalid media URL | 400 | `VALIDATION_ERROR` | `Media URL is invalid.` |
| Invalid pagination query | 400 | `VALIDATION_ERROR` | `Invalid pagination query.` |
| Post not found or soft deleted | 404 | `POST_NOT_FOUND` | `Post not found.` |
| Parent reply not found or soft deleted | 404 | `REPLY_NOT_FOUND` | `Reply not found.` |
| Reply target belongs to deleted post | 404 | `POST_NOT_FOUND` | `Post not found.` |
| User deletes another user's reply | 403 | `REPLY_FORBIDDEN` | `You are not allowed to modify this reply.` |
| Reply already deleted | 404 | `REPLY_NOT_FOUND` | `Reply not found.` |
| Unsupported moderation status in internal transition | 400 | `VALIDATION_ERROR` | `Moderation status is invalid.` |

Read APIs should not leak whether a soft-deleted reply existed before. Return
`REPLY_NOT_FOUND` for missing and soft-deleted replies.

## 8. Test Cases

### Create Top-Level Reply

- Creates a reply for an existing active post.
- Sets `parentReplyId = null`.
- Stores the correct `postId`.
- Uses authenticated user id as `authorId`.
- Trims `content` before saving.
- Defaults `mediaUrls` to `[]` when omitted.
- Defaults `moderationStatus`, `moderationScore`, and `moderationReason`.
- Returns the required reply response shape.
- Rejects missing JWT with 401.
- Rejects invalid `postId` with 400.
- Rejects missing or deleted post with 404.
- Rejects empty content when `mediaUrls` is empty with 400.

### Create Child Reply

- Creates a reply under an existing active reply.
- Copies `postId` from parent reply.
- Sets `parentReplyId` to the parent reply id.
- Does not accept or trust `postId` from the request body.
- Increments parent `childReplyCount` in the same transaction.
- Rejects missing or deleted parent reply with 404.
- Rejects child creation if the parent post is deleted.
- Returns `childReplyCount = 0` for the new child reply.

### List Post Replies

- Returns only top-level replies for the post.
- Excludes soft-deleted replies.
- Does not include child replies in the same response.
- Includes `childReplyCount` for each reply.
- Calculates `isLikedByMe = true` when optional JWT user liked the reply.
- Returns `isLikedByMe = false` without JWT.
- Supports `limit`, `cursor`, and deterministic sorting.
- Rejects invalid pagination query with 400.

### List Reply Children

- Returns only direct children of the requested reply.
- Does not return grandchildren.
- Excludes soft-deleted children.
- Supports the "Show replies" UI by returning items and `pageInfo`.
- Includes each child reply's own `childReplyCount`.
- Supports cursor pagination across multiple pages.
- Returns 404 when the parent reply does not exist or is soft deleted.

### Get Reply Thread

- Returns ancestor path from top-level reply to the focused reply parent.
- Returns the focused reply.
- Returns one page of direct children for the focused reply.
- Does not expand the full subtree.
- Preserves a stable response shape for the Flutter thread detail screen.
- Returns 404 when the focused reply does not exist or is soft deleted.

### Delete Reply

- Soft deletes own reply by setting `deletedAt`.
- Does not physically delete the reply record.
- Does not delete child replies.
- Excludes deleted reply from default list APIs.
- Decrements parent `childReplyCount` when deleting a child reply.
- Does not decrement post-level count unless a post reply count field exists and is part of the Posts module contract.
- Rejects delete by non-author with 403.
- Rejects missing JWT with 401.
- Returns 404 for missing or already deleted reply.

### Integration and Architecture

- `RepliesController` only handles routing, guards, DTO validation, and response mapping.
- `RepliesService` owns create, list, thread, and soft delete business logic.
- Prisma queries use indexes for `postId`, `parentReplyId`, `authorId`, `createdAt`, and `deletedAt`.
- Multi-write operations use Prisma transactions.
- Unit tests cover service rules with Prisma mocked.
- E2E tests cover all six endpoints with Supertest.
- Tests verify no response exposes internal fields such as `authorId`, `updatedAt`, `deletedAt`, `moderationScore`, or `moderationReason` unless explicitly required by a future API.
