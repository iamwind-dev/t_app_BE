# Posts Module OpenSpec

## 1. Goal

The Posts module provides APIs for authenticated users to create, read, update,
and soft delete Threads-style top-level posts.

The module must:

- Allow authenticated users to create posts with text and/or media.
- Provide a latest-post feed with cursor pagination.
- Provide post details with author information, reaction/reply counts, and whether the current user liked the post.
- Allow only the post owner to update or delete the post.
- Soft delete posts with `deletedAt`; never hard delete posts.
- Store `mediaUrls` so the Flutter client can display media uploaded and validated by the Uploads module.
- Reserve moderation fields `moderationStatus`, `moderationScore`, and `moderationReason`, without integrating AI moderation, queues, workers, or third-party services.

All APIs in this module are private and must use a JWT guard. The user id must
come from the JWT, not from the request body.

## 2. APIs

### 2.1 POST /posts

Creates a new post for the current user.

#### Authentication

```http
Authorization: Bearer jwt.access.token
```

#### Request Body

```json
{
  "content": "Today I started building a Threads clone.",
  "mediaUrls": [
    "https://cdn.example.com/uploads/post-image-1.jpg"
  ]
}
```

#### Request Fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `content` | string | conditional | Trim, maximum 500 characters. Required when `mediaUrls` is empty or omitted |
| `mediaUrls` | string[] | no | Maximum 10 items, each item must be a valid uploaded/validated URL |

#### Response 201

```json
{
  "success": true,
  "data": {
    "post": {
      "id": "9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1",
      "content": "Today I started building a Threads clone.",
      "mediaUrls": [
        "https://cdn.example.com/uploads/post-image-1.jpg"
      ],
      "moderationStatus": "approved",
      "createdAt": "2026-04-24T14:00:00.000Z",
      "author": {
        "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
        "username": "user_name",
        "displayName": "User Name",
        "avatarUrl": null
      },
      "likeCount": 0,
      "replyCount": 0,
      "isLikedByMe": false
    }
  }
}
```

### 2.2 GET /posts/feed

Returns the latest posts for the feed.

#### Authentication

```http
Authorization: Bearer jwt.access.token
```

#### Query Parameters

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `cursor` | string | no | Cursor of the last item on the previous page |
| `limit` | number | no | Default 20, minimum 1, maximum 50 |

#### Response 200

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1",
        "content": "Today I started building a Threads clone.",
        "mediaUrls": [
          "https://cdn.example.com/uploads/post-image-1.jpg"
        ],
        "moderationStatus": "approved",
        "createdAt": "2026-04-24T14:00:00.000Z",
        "author": {
          "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
          "username": "user_name",
          "displayName": "User Name",
          "avatarUrl": null
        },
        "likeCount": 12,
        "replyCount": 3,
        "isLikedByMe": true
      }
    ],
    "pageInfo": {
      "nextCursor": "2026-04-24T14:00:00.000Z_9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1",
      "hasNextPage": true
    }
  }
}
```

### 2.3 GET /posts/:id

Returns details for one post.

#### Authentication

```http
Authorization: Bearer jwt.access.token
```

#### Path Parameters

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | Valid post UUID |

#### Response 200

Uses the same post response shape as feed items.

### 2.4 PATCH /posts/:id

Updates a post owned by the current user.

#### Authentication

```http
Authorization: Bearer jwt.access.token
```

#### Path Parameters

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | Valid post UUID |

#### Request Body

```json
{
  "content": "Updated thread content.",
  "mediaUrls": [
    "https://cdn.example.com/uploads/post-image-2.jpg"
  ]
}
```

#### Request Fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `content` | string | no | Trim, maximum 500 characters |
| `mediaUrls` | string[] | no | Maximum 10 items, replaces the current media list when provided |

#### Response 200

Returns the updated post with the standard post response shape.

### 2.5 DELETE /posts/:id

Soft deletes a post owned by the current user by setting `deletedAt`.

#### Authentication

```http
Authorization: Bearer jwt.access.token
```

#### Path Parameters

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | Valid post UUID |

#### Response 200

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1",
    "deletedAt": "2026-04-24T14:05:00.000Z"
  }
}
```

## 3. Request/Response Samples

### Post Response Shape

Every response that returns a post to the client must use this stable shape:

```json
{
  "id": "9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1",
  "content": "Post content",
  "mediaUrls": [],
  "moderationStatus": "approved",
  "createdAt": "2026-04-24T14:00:00.000Z",
  "author": {
    "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
    "username": "user_name",
    "displayName": "User Name",
    "avatarUrl": null
  },
  "likeCount": 0,
  "replyCount": 0,
  "isLikedByMe": false
}
```

`moderationScore` and `moderationReason` are internal/future-facing fields and
are not required in the default post response. If a future admin or moderation
screen needs them, it must define a separate response shape.

### Error Response Shape

```json
{
  "success": false,
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "Post was not found."
  }
}
```

## 4. Business Rules

- Users must be authenticated to create posts, read feed, read details, update posts, or delete posts.
- `authorId` must come from the JWT when creating a post and must not be accepted from the request body.
- A post must include at least one of: non-empty trimmed `content` or at least one `mediaUrls` URL.
- `content` must be trimmed before saving.
- `mediaUrls` are URLs accepted by the Uploads module; Posts must not expose internal storage paths.
- New posts default to:
  - `likeCount = 0`
  - `replyCount = 0`
  - `moderationStatus = "approved"` for the MVP because there is no real AI moderation yet
  - `moderationScore = null`
  - `moderationReason = null`
  - `deletedAt = null`
- Feed and detail only return posts where `deletedAt = null`.
- Feed only returns posts whose `moderationStatus` is not rejected. In the MVP, new posts are approved by default.
- `PATCH /posts/:id` only allows the post author to update the post.
- `DELETE /posts/:id` only allows the post author to soft delete the post.
- Delete must set `deletedAt` and must not remove the row from PostgreSQL.
- Updating a post must not reset `likeCount`, `replyCount`, `createdAt`, `authorId`, or `deletedAt`.
- If a post has been soft deleted, later update/delete attempts must return not found or idempotent delete according to service policy. MVP uses `POST_NOT_FOUND` to avoid leaking internal information.
- `isLikedByMe` must be computed from the current user and the user's active reaction to the post.
- Do not call AI services, create moderation queues, or block post creation for moderation automation.

## 5. Pagination Rules

- `GET /posts/feed` uses cursor pagination, not offset pagination.
- Default sort: `createdAt DESC`, tie-break with `id DESC` for stable ordering.
- Default `limit` is 20.
- Maximum `limit` is 50. If a client sends a value above 50, reject with `VALIDATION_ERROR`.
- `cursor` should encode the `createdAt` and `id` of the last item on the current page.
- When `cursor` is provided, query posts older than the cursor using the `(createdAt, id)` pair.
- Service should query `limit + 1` items to calculate `hasNextPage`.
- `nextCursor` is `null` when no next page exists.
- Feed response must return `items` and `pageInfo`.

## 6. Validation Rules

### Shared

- Every private endpoint must include `Authorization: Bearer <token>`.
- `:id` must be a valid UUID.
- DTOs must validate body, params, and query with `class-validator` / `class-transformer`.
- Request bodies should not accept unknown fields when the project has whitelist validation configured.

### Create Post

- `content`:
  - Optional when `mediaUrls` contains at least one item.
  - Required when `mediaUrls` is empty or omitted.
  - Trim before empty validation.
  - Maximum 500 characters.
- `mediaUrls`:
  - Optional.
  - Must be an array when provided.
  - Maximum 10 items.
  - Each item must be a valid URL.
  - Empty strings are not accepted.
- Reject the request when both `content` and `mediaUrls` are empty.

### Update Post

- Body must contain at least one updatable field: `content` or `mediaUrls`.
- If an update would leave the post with neither `content` nor `mediaUrls`, reject the request.
- Clients must not update `authorId`, `likeCount`, `replyCount`, `moderationScore`, `moderationReason`, `createdAt`, `updatedAt`, or `deletedAt`.
- In the MVP, clients cannot update `moderationStatus`; it is owned by the service or a future admin flow.

### Feed

- `limit` must be an integer.
- `limit` must be between 1 and 50.
- `cursor`, when provided, must match the cursor format issued by the service.

## 7. Error Cases

| Case | HTTP Status | Error Code | Message |
| --- | --- | --- | --- |
| Missing bearer token | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| Both `content` and `mediaUrls` are empty on create | 400 | `VALIDATION_ERROR` | `Post must include content or media.` |
| `content` exceeds character limit | 400 | `VALIDATION_ERROR` | `Content must be at most 500 characters.` |
| `mediaUrls` is not an array | 400 | `VALIDATION_ERROR` | `mediaUrls must be an array.` |
| `mediaUrls` contains invalid URL | 400 | `VALIDATION_ERROR` | `Each media URL must be valid.` |
| `mediaUrls` exceeds 10 items | 400 | `VALIDATION_ERROR` | `A post can include at most 10 media items.` |
| `id` is not a UUID | 400 | `VALIDATION_ERROR` | `Post id must be a valid UUID.` |
| Invalid `limit` | 400 | `VALIDATION_ERROR` | `Limit must be between 1 and 50.` |
| Invalid `cursor` | 400 | `INVALID_CURSOR` | `Pagination cursor is invalid.` |
| Post does not exist or is soft deleted | 404 | `POST_NOT_FOUND` | `Post was not found.` |
| User updating another user's post | 403 | `POST_FORBIDDEN` | `You are not allowed to modify this post.` |
| User deleting another user's post | 403 | `POST_FORBIDDEN` | `You are not allowed to modify this post.` |
| Update body has no valid fields | 400 | `VALIDATION_ERROR` | `No valid fields were provided for update.` |
| Update would make post empty | 400 | `VALIDATION_ERROR` | `Post must include content or media.` |

Authorization errors must not leak sensitive information. Not found errors for
soft-deleted posts must match not found errors for posts that never existed.

## 8. Test Cases

### Create Post

- Creates a post successfully with valid `content`.
- Creates a post successfully with `mediaUrls` and empty/omitted content.
- Creates a post successfully with both `content` and `mediaUrls`.
- Trims `content` before saving.
- Sets `authorId` from JWT, not from the request body.
- Sets default `likeCount`, `replyCount`, `moderationStatus`, `moderationScore`, `moderationReason`, and `deletedAt` correctly.
- Create response uses the post response shape and does not return internal Prisma fields.
- Rejects a request with neither content nor media with status 400.
- Rejects content longer than 500 characters with status 400.
- Rejects invalid media URL format with status 400.
- Rejects more than 10 media URLs with status 400.
- Rejects missing JWT with status 401.

### Feed

- Returns latest posts by `createdAt DESC`, `id DESC`.
- Does not return soft-deleted posts.
- Does not return posts with `moderationStatus = "rejected"`.
- Returns `author`, `likeCount`, `replyCount`, and `isLikedByMe` for each item.
- `isLikedByMe` is true when the current user has actively liked the post.
- Supports default `limit` 20.
- Supports cursor pagination and returns correct `nextCursor` and `hasNextPage`.
- Rejects `limit` below 1 or above 50 with status 400.
- Rejects invalid cursor format with status 400.

### Get Post Detail

- Returns post detail successfully with a valid id.
- Detail includes `author`, `likeCount`, `replyCount`, and `isLikedByMe`.
- Does not return `moderationScore` or `moderationReason` in the default public response.
- Returns 404 when post does not exist.
- Returns 404 when post is soft deleted.
- Rejects invalid UUID with status 400.

### Update Post

- Author updates `content` successfully.
- Author updates `mediaUrls` successfully.
- Author updates both `content` and `mediaUrls` successfully.
- Trims content on update.
- Does not change `authorId`, `likeCount`, `replyCount`, or `createdAt` on update.
- Rejects non-author with status 403.
- Rejects update for soft-deleted post with status 404.
- Rejects empty body or no valid fields with status 400.
- Rejects update that leaves no content and no media with status 400.
- Rejects client updates to moderation fields with status 400 or strips them according to the project's ValidationPipe policy.

### Delete Post

- Author soft deletes a post successfully and sets `deletedAt`.
- Delete does not hard delete the database row.
- Deleted post does not appear in feed.
- Deleted post cannot be read through detail endpoint.
- Rejects non-author with status 403.
- Rejects invalid UUID with status 400.
- Rejects missing post with status 404.

### Security and Integration

- All Posts endpoints are protected by a JWT guard.
- Service does not trust `authorId` from the request body.
- Default Prisma queries filter `deletedAt = null` for feed/detail/update/delete.
- Unit tests mock Prisma for create, feed, detail, update, and soft delete business logic.
- E2E tests use Supertest for `POST /posts`, `GET /posts/feed`, `GET /posts/:id`, `PATCH /posts/:id`, and `DELETE /posts/:id`.
