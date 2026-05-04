# Reactions Module OpenSpec

## 1. Goal

The Reactions module provides APIs for authenticated users to like and unlike
posts and replies in the Threads-like application.

Main goals:

- Allow one user to like one post at most once.
- Allow one user to like one reply at most once.
- Allow idempotent unlike: if the user has not liked the target, the request still succeeds and returns the current state.
- Return `likeCount` and `isLiked` after each like/unlike operation so the Flutter client can update UI immediately.
- Do not allow likes on soft-deleted posts or replies.
- Keep like counts consistent with reaction records, using transactions when reaction writes and counter updates must be updated together.

## 2. APIs

All APIs in this module are private and must use a JWT authentication guard.
User id always comes from the JWT, not from the request body.

### POST /posts/:postId/like

Likes a post.

- Access: private.
- Params: `postId` is a valid UUID.
- Success status: `200 OK`.
- If the user already liked the post, the API still succeeds with the current state and does not create a duplicate reaction.

Response:

```json
{
  "success": true,
  "data": {
    "postId": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
    "likeCount": 12,
    "isLiked": true
  }
}
```

### DELETE /posts/:postId/like

Unlikes a post.

- Access: private.
- Params: `postId` is a valid UUID.
- Success status: `200 OK`.
- If the user has not liked the post, the API still succeeds with `isLiked: false` and the current `likeCount`.

Response:

```json
{
  "success": true,
  "data": {
    "postId": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
    "likeCount": 11,
    "isLiked": false
  }
}
```

### POST /replies/:replyId/like

Likes a reply.

- Access: private.
- Params: `replyId` is a valid UUID.
- Success status: `200 OK`.
- If the user already liked the reply, the API still succeeds with the current state and does not create a duplicate reaction.

Response:

```json
{
  "success": true,
  "data": {
    "replyId": "6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32",
    "likeCount": 5,
    "isLiked": true
  }
}
```

### DELETE /replies/:replyId/like

Unlikes a reply.

- Access: private.
- Params: `replyId` is a valid UUID.
- Success status: `200 OK`.
- If the user has not liked the reply, the API still succeeds with `isLiked: false` and the current `likeCount`.

Response:

```json
{
  "success": true,
  "data": {
    "replyId": "6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32",
    "likeCount": 4,
    "isLiked": false
  }
}
```

## 3. Business Rules

- Every endpoint must require a valid JWT.
- User id must come from the authenticated token context.
- `postId` and `replyId` must be validated as valid UUIDs.
- Likes apply only to posts/replies that exist and are not soft deleted.
- Soft-deleted posts/replies have `deletedAt` not equal to `null`.
- Do not create new likes on soft-deleted posts/replies.
- One user can have only one active like for each post.
- One user can have only one active like for each reply.
- Duplicate likes must be idempotent: no error, and `likeCount` must not increment again.
- Unlike must be idempotent: if the reaction does not exist or is inactive, do not fail; return `isLiked: false`.
- If reactions use soft delete, unlike marks the reaction inactive or sets a deletion marker instead of hard deleting, depending on the selected Prisma schema.
- If reactions use hard delete, deletion and counter decrement must remain consistent.
- `likeCount` must never be below `0`.
- Each create/delete reaction operation with a `likeCount` update must run in a transaction to avoid count drift under concurrent requests.
- Database should have unique constraints or unique indexes to prevent duplicate active reactions for `userId + postId` and `userId + replyId`.
- Responses after every operation must return the latest count and current user's like state:
  - Post response: `postId`, `likeCount`, `isLiked`.
  - Reply response: `replyId`, `likeCount`, `isLiked`.
- Reactions module must not call AI moderation, create queues or workers, or integrate third-party moderation services.

## 4. Error Cases

All errors should use the shared response shape:

```json
{
  "success": false,
  "error": {
    "code": "REACTION_TARGET_NOT_FOUND",
    "message": "Target content was not found."
  }
}
```

| Case | HTTP Status | Error Code | Message |
| --- | --- | --- | --- |
| Missing bearer token | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| `postId` is not a valid UUID | 400 | `VALIDATION_ERROR` | `Post id must be a valid UUID.` |
| `replyId` is not a valid UUID | 400 | `VALIDATION_ERROR` | `Reply id must be a valid UUID.` |
| Post does not exist | 404 | `REACTION_TARGET_NOT_FOUND` | `Target content was not found.` |
| Reply does not exist | 404 | `REACTION_TARGET_NOT_FOUND` | `Target content was not found.` |
| Like soft-deleted post | 404 | `REACTION_TARGET_NOT_FOUND` | `Target content was not found.` |
| Like soft-deleted reply | 404 | `REACTION_TARGET_NOT_FOUND` | `Target content was not found.` |
| Conflict from concurrent duplicate like | 200 | none | Return the current state without incrementing count again. |
| Unlike when user has not liked | 200 | none | Return `isLiked: false` and the current `likeCount`. |

## 5. Test Cases

### Post Likes

- Likes a post successfully with an authenticated user.
- Like post response returns correct `postId`, `likeCount`, and `isLiked: true`.
- Liking the same post twice by the same user does not create duplicate reactions.
- Liking the same post twice by the same user increments `likeCount` only once.
- Different users liking the same post increment `likeCount` per user.
- Unlikes a post successfully after the user liked it.
- Unlike post response returns correct `postId`, `likeCount`, and `isLiked: false`.
- Unlike post when the user has not liked does not error and does not make `likeCount` negative.
- Does not allow liking a soft-deleted post.
- Does not allow liking a missing post.
- Rejects invalid `postId` format with status 400.

### Reply Likes

- Likes a reply successfully with an authenticated user.
- Like reply response returns correct `replyId`, `likeCount`, and `isLiked: true`.
- Liking the same reply twice by the same user does not create duplicate reactions.
- Liking the same reply twice by the same user increments `likeCount` only once.
- Different users liking the same reply increment `likeCount` per user.
- Unlikes a reply successfully after the user liked it.
- Unlike reply response returns correct `replyId`, `likeCount`, and `isLiked: false`.
- Unlike reply when the user has not liked does not error and does not make `likeCount` negative.
- Does not allow liking a soft-deleted reply.
- Does not allow liking a missing reply.
- Rejects invalid `replyId` format with status 400.

### Authentication and Consistency

- All like/unlike endpoints reject missing JWT.
- All like/unlike endpoints reject invalid or expired JWT.
- Service does not accept `userId` from the request body for any reaction API.
- Concurrent duplicate likes on the same target do not create multiple active reactions.
- Concurrent like/unlike operations do not make `likeCount` drift from active reactions.
- Unit tests mock Prisma to verify idempotent like/unlike business rules.
- E2E tests use Supertest for:
  - `POST /posts/:postId/like`
  - `DELETE /posts/:postId/like`
  - `POST /replies/:replyId/like`
  - `DELETE /replies/:replyId/like`
