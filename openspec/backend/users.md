# Users Module OpenSpec

## 1. Goal

The Users module provides profile management APIs for the NestJS + Prisma backend:

- View a public profile by user id.
- View a public profile by username.
- Update the profile of the currently authenticated user.
- List a user's posts for the Flutter profile screen.

The module must clearly separate public profile data from private account data.
Users APIs must not return `passwordHash`, refresh tokens, JWT metadata, or
internal security fields.

## 2. APIs

### 2.1 GET /users/:id

Returns a user's public profile by UUID.

#### Authentication

Public API. JWT is not required.

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | Valid UUID |

#### Response 200

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
      "username": "user_name",
      "displayName": "User Name",
      "bio": "Building a mobile-first social app.",
      "avatarUrl": "https://cdn.example.com/avatars/user.png",
      "followerCount": 24,
      "followingCount": 18,
      "postCount": 12,
      "createdAt": "2026-04-24T14:00:00.000Z",
      "updatedAt": "2026-04-24T14:00:00.000Z"
    }
  }
}
```

### 2.2 GET /users/username/:username

Returns a user's public profile by username.

#### Authentication

Public API. JWT is not required.

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `username` | string | yes | Trim, 3-30 characters, letters, numbers, `_`, and `.` only |

#### Response 200

Uses the same public profile response shape as `GET /users/:id`.

### 2.3 PATCH /users/me

Updates the current user's profile.

#### Authentication

Private API. JWT is required:

```http
Authorization: Bearer jwt.access.token
```

The user id must come from the JWT, not from the request body.

#### Request Body

All fields are optional, but the body must contain at least one valid field.

```json
{
  "username": "new_user_name",
  "displayName": "New Display Name",
  "bio": "Updated profile bio.",
  "avatarUrl": "https://cdn.example.com/avatars/new-user.png"
}
```

#### Request Fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `username` | string | no | Unique, trim, 3-30 characters, letters, numbers, `_`, and `.` only |
| `displayName` | string | no | Trim, 1-80 characters when provided |
| `bio` | string | no | Trim, maximum 160 characters, allow `null` to remove bio |
| `avatarUrl` | string | no | Valid URL, maximum 2048 characters, allow `null` to remove avatar |

#### Response 200

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
      "username": "new_user_name",
      "displayName": "New Display Name",
      "bio": "Updated profile bio.",
      "avatarUrl": "https://cdn.example.com/avatars/new-user.png",
      "followerCount": 24,
      "followingCount": 18,
      "postCount": 12,
      "createdAt": "2026-04-24T14:00:00.000Z",
      "updatedAt": "2026-04-24T15:00:00.000Z"
    }
  }
}
```

### 2.4 GET /users/:id/posts

Lists a user's top-level posts for profile display.

#### Authentication

Public API. JWT is not required.

#### Path Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | Valid UUID |

#### Query Params

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `limit` | number | no | Items per page, default `20`, maximum `50` |
| `cursor` | string | no | Cursor for the last item on the previous page, preferably a post id or stable encoded cursor |

#### Response 200

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "f67b01fd-97a5-441f-bb63-9550e5f5ef38",
        "author": {
          "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
          "username": "user_name",
          "displayName": "User Name",
          "avatarUrl": "https://cdn.example.com/avatars/user.png"
        },
        "content": "Hello from the profile timeline.",
        "mediaUrls": [],
        "replyCount": 2,
        "reactionCount": 9,
        "moderationStatus": "approved",
        "createdAt": "2026-04-24T14:30:00.000Z",
        "updatedAt": "2026-04-24T14:30:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": "f67b01fd-97a5-441f-bb63-9550e5f5ef38",
      "hasNextPage": true
    }
  }
}
```

## 3. Request/Response Samples

### Get User By ID

```http
GET /users/7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1
```

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
      "username": "user_name",
      "displayName": "User Name",
      "bio": null,
      "avatarUrl": null,
      "followerCount": 0,
      "followingCount": 0,
      "postCount": 0,
      "createdAt": "2026-04-24T14:00:00.000Z",
      "updatedAt": "2026-04-24T14:00:00.000Z"
    }
  }
}
```

### Update Current User Profile

```http
PATCH /users/me
Authorization: Bearer jwt.access.token
Content-Type: application/json
```

```json
{
  "displayName": "User Name",
  "bio": "Mobile app builder."
}
```

### List User Posts

```http
GET /users/7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1/posts?limit=20&cursor=f67b01fd-97a5-441f-bb63-9550e5f5ef38
```

```json
{
  "success": true,
  "data": {
    "items": [],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## 4. Business Rules

- User profile responses must not return `passwordHash`, password salt, refresh tokens, JWT metadata, email verification tokens, password reset tokens, or internal security fields.
- Public profiles must not return email unless a separate private account API explicitly specifies it.
- `PATCH /users/me` must be protected by a JWT guard.
- Only the current user can edit their own profile.
- The service must get the current user id from the JWT payload and must not trust a user id from the request body.
- Username must be unique in PostgreSQL through a Prisma unique constraint.
- Updating username should allow the user to keep their current username.
- If the new username belongs to another user, return 409.
- Username should be normalized consistently before comparison and persistence, at minimum by trimming.
- Soft-deleted or disabled users must not appear in public profile APIs.
- `GET /users/:id/posts` returns only top-level posts by that user and excludes soft-deleted posts.
- `GET /users/:id/posts` must use cursor pagination and a stable sort: `createdAt DESC`, then `id DESC` as a tie-breaker when needed.
- Controllers should only handle routing, DTO validation, and auth context; business rules belong in the Users service.
- Prisma access must go through the existing Prisma service.

## 5. Validation Rules

### Path Params

- `id`:
  - Required.
  - Must be a valid UUID.
- `username`:
  - Required.
  - Trim before validation.
  - Length from 3 to 30 characters.
  - Only letters, numbers, `_`, and `.` are allowed.
  - Must not start or end with `.`.

### PATCH /users/me Body

- Body must contain at least one of `username`, `displayName`, `bio`, or `avatarUrl`.
- Clients must not update `id`, `email`, `passwordHash`, `createdAt`, `updatedAt`, count fields, role, status, or auth metadata.
- `username`:
  - Optional.
  - Trim.
  - Length from 3 to 30 characters.
  - Only letters, numbers, `_`, and `.` are allowed.
  - Must not start or end with `.`.
  - Must be unique when different from the current username.
- `displayName`:
  - Optional.
  - Trim.
  - Must not be empty after trimming when provided.
  - Maximum 80 characters.
- `bio`:
  - Optional.
  - Trim when it is a string.
  - Maximum 160 characters.
  - Allow `null` to remove bio.
- `avatarUrl`:
  - Optional.
  - Must be a valid URL when it is a string.
  - Maximum 2048 characters.
  - Allow `null` to remove avatar.

### Query Params for /users/:id/posts

- `limit`:
  - Optional.
  - Must be an integer from 1 to 50.
  - Default is 20 when omitted.
- `cursor`:
  - Optional.
  - Must not be empty when provided.
  - Must match a service-supported format, such as a UUID post id or encoded cursor.

## 6. Error Cases

Error responses should use the shared shape:

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found."
  }
}
```

| Case | HTTP Status | Error Code | Message |
| --- | --- | --- | --- |
| `id` is not a valid UUID | 400 | `VALIDATION_ERROR` | `Invalid user id.` |
| Invalid `username` format | 400 | `VALIDATION_ERROR` | `Username format is invalid.` |
| Invalid or out-of-range `limit` | 400 | `VALIDATION_ERROR` | `Invalid pagination limit.` |
| Invalid `cursor` format | 400 | `VALIDATION_ERROR` | `Invalid cursor.` |
| Empty update body | 400 | `VALIDATION_ERROR` | `At least one profile field is required.` |
| Update body contains unsupported fields | 400 | `VALIDATION_ERROR` | `Request contains unsupported fields.` |
| `displayName` empty after trim | 400 | `VALIDATION_ERROR` | `Display name cannot be empty.` |
| `bio` exceeds limit | 400 | `VALIDATION_ERROR` | `Bio is too long.` |
| `avatarUrl` is not a valid URL | 400 | `VALIDATION_ERROR` | `Avatar URL must be valid.` |
| Missing bearer token while updating profile | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| User does not exist, is soft deleted, or is disabled | 404 | `USER_NOT_FOUND` | `User not found.` |
| New username is used by another user | 409 | `USER_USERNAME_TAKEN` | `Username is already taken.` |
| Prisma unique constraint conflict while updating username | 409 | `USER_USERNAME_TAKEN` | `Username is already taken.` |

Public APIs should not reveal whether a user previously existed and was soft
deleted or disabled. Those cases return the same `USER_NOT_FOUND` error.

## 7. Test Cases

### GET /users/:id

- Returns public profile when the user exists and is active.
- Response does not contain `passwordHash`, private email, refresh tokens, or auth metadata.
- Returns 400 when `id` is not a UUID.
- Returns 404 when the user does not exist.
- Returns 404 when the user is soft deleted or disabled.

### GET /users/username/:username

- Returns public profile when username exists.
- Trims username input before query.
- Response does not contain `passwordHash`.
- Returns 400 when username is too short, too long, or contains invalid characters.
- Returns 404 when username does not exist.
- Returns 404 when the user is soft deleted or disabled.

### PATCH /users/me

- Updates `displayName`, `bio`, and `avatarUrl` successfully with a valid JWT.
- Updates username successfully when the new username is unused.
- Allows a user to keep the current username.
- Trims `username`, `displayName`, and `bio` before saving.
- Allows setting `bio` to `null` to remove bio.
- Allows setting `avatarUrl` to `null` to remove avatar.
- Update response does not contain `passwordHash`.
- Rejects missing JWT with status 401.
- Rejects invalid or expired token with status 401.
- Rejects empty body with status 400.
- Rejects unsupported fields like `id`, `email`, or `passwordHash` with status 400.
- Rejects invalid username format with status 400.
- Rejects duplicate username with status 409.
- Ensures a user cannot edit another user's profile by sending a user id in the body.
- Handles Prisma unique constraint race conditions when two requests change to the same username.

### GET /users/:id/posts

- Returns the user's posts ordered by `createdAt DESC`.
- Uses default `limit` 20 when omitted.
- Limits `limit` to 50.
- Returns correct `pageInfo.nextCursor` and `pageInfo.hasNextPage` when more pages exist.
- Excludes soft-deleted posts.
- Does not return posts from another user.
- Returns 400 when `id` is not a UUID.
- Returns 400 when `limit` or `cursor` is invalid.
- Returns 404 when the user does not exist, is soft deleted, or is disabled.

### Integration

- Users controller uses DTOs for params, query, and request body.
- `PATCH /users/me` is protected by the JWT guard.
- Users service gets the authenticated user id from request context/JWT, not from the body.
- Prisma queries select only public profile fields that should be returned.
- E2E tests use Supertest for the four Users endpoints.
