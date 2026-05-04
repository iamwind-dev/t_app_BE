# Follows Module OpenSpec

## 1. Goal

The Follows module manages follow relationships between users in the social
networking application.

Main goals:

- Allow authenticated users to follow or unfollow other users.
- Allow viewing a user's followers and following lists.
- Ensure there is no duplicate active follow relationship between the same pair of users.
- Return a stable profile shape for the mobile client, including `followersCount`, `followingCount`, and `isFollowing`.
- Use JWT authentication for actions that require current-user context.

The module must use the existing Prisma service to access PostgreSQL. Do not add
queues, external services, or new providers.

## 2. APIs

### POST /users/:userId/follow

Follows the user identified by `userId`.

- Access: private.
- Guard: JWT authentication guard.
- Controller: `FollowsController.follow`.
- Service: `FollowsService.follow`.
- Success status: `200 OK`.
- Path params:
  - `userId`: id of the user being followed.

### DELETE /users/:userId/follow

Unfollows the user identified by `userId`.

- Access: private.
- Guard: JWT authentication guard.
- Controller: `FollowsController.unfollow`.
- Service: `FollowsService.unfollow`.
- Success status: `200 OK`.
- Path params:
  - `userId`: id of the user being unfollowed.

### GET /users/:userId/followers

Gets users who follow the specified user.

- Access: public or optional private auth if `isFollowing` needs to be calculated.
- Controller: `FollowsController.getFollowers`.
- Service: `FollowsService.getFollowers`.
- Success status: `200 OK`.
- Pagination: cursor pagination.
- Path params:
  - `userId`: id of the user whose followers are being viewed.
- Query params:
  - `cursor`: optional, follow id or `createdAt` cursor of the last item on the previous page.
  - `limit`: optional, default `20`, maximum `50`.

### GET /users/:userId/following

Gets users followed by the specified user.

- Access: public or optional private auth if `isFollowing` needs to be calculated.
- Controller: `FollowsController.getFollowing`.
- Service: `FollowsService.getFollowing`.
- Success status: `200 OK`.
- Pagination: cursor pagination.
- Path params:
  - `userId`: id of the user whose following list is being viewed.
- Query params:
  - `cursor`: optional, follow id or `createdAt` cursor of the last item on the previous page.
  - `limit`: optional, default `20`, maximum `50`.

## 3. Request/Response Samples

### POST /users/:userId/follow

Request:

```http
POST /users/82f6c1b8-1ad2-45f2-80ec-4ed12c9d9321/follow
Authorization: Bearer jwt.access.token
```

Request body: none.

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "82f6c1b8-1ad2-45f2-80ec-4ed12c9d9321",
      "username": "target_user",
      "displayName": "Target User",
      "avatarUrl": null,
      "bio": "Hello from Threads-like app.",
      "followersCount": 16,
      "followingCount": 9,
      "isFollowing": true
    }
  }
}
```

### DELETE /users/:userId/follow

Request:

```http
DELETE /users/82f6c1b8-1ad2-45f2-80ec-4ed12c9d9321/follow
Authorization: Bearer jwt.access.token
```

Request body: none.

Response `200 OK` returns the same profile shape with `isFollowing: false`.

### GET /users/:userId/followers

Request:

```http
GET /users/82f6c1b8-1ad2-45f2-80ec-4ed12c9d9321/followers?limit=20
Authorization: Bearer jwt.access.token
```

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
        "username": "follower_user",
        "displayName": "Follower User",
        "avatarUrl": null,
        "bio": null,
        "followersCount": 12,
        "followingCount": 22,
        "isFollowing": true,
        "followedAt": "2026-04-24T14:00:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": "2026-04-24T14:00:00.000Z",
      "hasNextPage": false
    }
  }
}
```

### GET /users/:userId/following

Request:

```http
GET /users/82f6c1b8-1ad2-45f2-80ec-4ed12c9d9321/following?limit=20
Authorization: Bearer jwt.access.token
```

Response uses the same paginated profile item shape as followers.

### Error Response Shape

```json
{
  "success": false,
  "error": {
    "code": "FOLLOW_SELF_NOT_ALLOWED",
    "message": "Users cannot follow themselves."
  }
}
```

## 4. Business Rules

- User must be authenticated to follow or unfollow.
- Authenticated user id must come from JWT, not from the request body.
- `userId` in the path is the target user id.
- Users cannot follow themselves.
- Target user must exist and must not be soft deleted.
- Do not create duplicate active follows for the same `followerId` and `followingId` pair.
- If a user calls follow repeatedly for the same target, the API must be idempotent: do not create another record and return the target profile with `isFollowing: true`.
- If a user unfollows a target they never followed or whose follow is inactive, do not fail; return `200 OK` with `isFollowing: false`.
- If follow relationships use soft delete, unfollow should mark the relationship inactive or set `deletedAt`, not hard delete when audit/social history is required.
- If a soft-deleted follow relationship is followed again, the service should reactivate the old record or create a new record according to the agreed Prisma schema strategy, while still ensuring only one active follow exists.
- `followersCount` is the number of active followers of the profile.
- `followingCount` is the number of active following relationships of the profile.
- `isFollowing` indicates whether the authenticated viewer currently follows that profile.
- For public requests without JWT, `isFollowing` should be `false` or `null` according to the chosen response contract; `false` is recommended for simpler Flutter handling.
- Followers/following lists must use pagination and a stable sort, defaulting to newest follow first.
- List APIs must not return password hashes, private email, token metadata, or sensitive internal fields.
- Add indexes for query-heavy fields: `followerId`, `followingId`, and a unique active relationship for `followerId + followingId`.

## 5. Error Cases

### 401 Unauthorized

Applies to `POST /users/:userId/follow` and `DELETE /users/:userId/follow` when
JWT is missing or invalid.

```json
{
  "success": false,
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "Authentication is required."
  }
}
```

### 400 Bad Request - Invalid User ID

`userId` does not match the id format used by the project.

```json
{
  "success": false,
  "error": {
    "code": "USER_INVALID_ID",
    "message": "Invalid user id."
  }
}
```

### 400 Bad Request - Follow Self

Authenticated user tries to follow themselves.

```json
{
  "success": false,
  "error": {
    "code": "FOLLOW_SELF_NOT_ALLOWED",
    "message": "Users cannot follow themselves."
  }
}
```

### 404 Not Found - Target User Not Found

Target user does not exist or has been soft deleted.

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found."
  }
}
```

### 400 Bad Request - Invalid Pagination

`limit` exceeds the limit, is below 1, or `cursor` is invalid.

```json
{
  "success": false,
  "error": {
    "code": "PAGINATION_INVALID",
    "message": "Invalid pagination parameters."
  }
}
```

### 409 Conflict - Duplicate Follow Constraint

If a race condition causes the database unique constraint to report a duplicate
active follow, the service should catch it and return an idempotent success
response if the active relationship already exists. Only return an error when
the relationship state cannot be safely determined.

```json
{
  "success": false,
  "error": {
    "code": "FOLLOW_CONFLICT",
    "message": "Follow relationship could not be updated safely."
  }
}
```

## 6. Test Cases

### Follow

- Follows another user successfully and returns `isFollowing: true`.
- Follow increments the target user's `followersCount` by 1.
- Follow increments the authenticated user's `followingCount` by 1.
- Following self returns `400` with code `FOLLOW_SELF_NOT_ALLOWED`.
- Following a missing target user returns `404` with code `USER_NOT_FOUND`.
- Following a soft-deleted target user returns `404` with code `USER_NOT_FOUND`.
- Following the same target multiple times does not create duplicate active follows.
- Following the same target multiple times still returns `200 OK` and `isFollowing: true`.
- Follow without JWT returns `401`.

### Unfollow

- Unfollows a followed user successfully and returns `isFollowing: false`.
- Unfollow decrements the target user's `followersCount` by 1.
- Unfollow decrements the authenticated user's `followingCount` by 1.
- Unfollowing a target that was never followed does not fail and returns `200 OK` with `isFollowing: false`.
- Unfollowing a missing target returns `404` with code `USER_NOT_FOUND`.
- Unfollow without JWT returns `401`.
- Unfollow must not make counts negative when the relationship does not exist.

### Followers List

- Returns follower profiles with `followersCount`, `followingCount`, `isFollowing`, and `followedAt`.
- Followers list includes only active follows.
- Followers list excludes soft-deleted users.
- Pagination `limit` works correctly.
- `nextCursor` and `hasNextPage` correctly reflect the next page.
- Default sort is newest `followedAt` first.
- Invalid `limit` returns `400` with code `PAGINATION_INVALID`.
- Missing target user returns `404` with code `USER_NOT_FOUND`.

### Following List

- Returns following profiles with `followersCount`, `followingCount`, `isFollowing`, and `followedAt`.
- Following list includes only active follows.
- Following list excludes soft-deleted target users.
- Pagination `limit` works correctly.
- `nextCursor` and `hasNextPage` correctly reflect the next page.
- Default sort is newest `followedAt` first.
- Invalid `cursor` returns `400` with code `PAGINATION_INVALID`.
- Missing target user returns `404` with code `USER_NOT_FOUND`.

### Response Contract

- Profile response does not return private email for public profile endpoints.
- Profile response does not return password hash, refresh tokens, or auth metadata.
- `followersCount` and `followingCount` are always numbers.
- `isFollowing` is always present in profile responses.
- Public or optional-auth requests without JWT still return lists successfully, with `isFollowing` following the chosen contract.
