# Auth Module OpenSpec

## 1. Goal

The Auth module provides the basic authentication flow for the NestJS backend:

- Register accounts with email, username, and password.
- Log in with email or username plus password.
- Issue JWT access tokens for the Flutter client.
- Return the current user through a JWT-protected endpoint.

The module must use Prisma to access PostgreSQL, bcrypt to hash passwords, and
must not return `passwordHash` or internal security metadata to the client.

## 2. APIs

### POST /auth/register

Creates a new account and returns public user information with a JWT.

- Access: public.
- Controller: `AuthController.register`.
- Service: `AuthService.register`.
- Success status: `201 Created`.

### POST /auth/login

Authenticates a user with email or username and password, then returns a JWT.

- Access: public.
- Controller: `AuthController.login`.
- Service: `AuthService.login`.
- Success status: `200 OK`.

### GET /auth/me

Returns the current user from a valid JWT.

- Access: private.
- Guard: JWT authentication guard.
- Controller: `AuthController.me`.
- Service: `AuthService.getCurrentUser`.
- Success status: `200 OK`.

## 3. Request Body

### POST /auth/register

```json
{
  "email": "user@example.com",
  "username": "user_name",
  "password": "StrongPassword123!",
  "displayName": "User Name"
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `email` | string | yes | Valid email, unique, trim, lowercase before saving |
| `username` | string | yes | Unique, trim, letters, numbers, underscores, or dots only |
| `password` | string | yes | At least 8 characters, must include letters and numbers |
| `displayName` | string | no | Trim, maximum 80 characters |

### POST /auth/login

```json
{
  "identifier": "user@example.com",
  "password": "StrongPassword123!"
}
```

`identifier` can be an email or a username.

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `identifier` | string | yes | Trim, non-empty, find user by lowercase email or username |
| `password` | string | yes | Non-empty |

### GET /auth/me

No request body.

The request must include this header:

```http
Authorization: Bearer jwt.access.token
```

## 4. Response Samples

### POST /auth/register - 201 Created

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
      "email": "user@example.com",
      "username": "user_name",
      "displayName": "User Name",
      "avatarUrl": null,
      "createdAt": "2026-04-24T14:00:00.000Z",
      "updatedAt": "2026-04-24T14:00:00.000Z"
    },
    "accessToken": "jwt.access.token"
  }
}
```

### POST /auth/login - 200 OK

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
      "email": "user@example.com",
      "username": "user_name",
      "displayName": "User Name",
      "avatarUrl": null,
      "createdAt": "2026-04-24T14:00:00.000Z",
      "updatedAt": "2026-04-24T14:00:00.000Z"
    },
    "accessToken": "jwt.access.token"
  }
}
```

### GET /auth/me - 200 OK

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1",
      "email": "user@example.com",
      "username": "user_name",
      "displayName": "User Name",
      "avatarUrl": null,
      "createdAt": "2026-04-24T14:00:00.000Z",
      "updatedAt": "2026-04-24T14:00:00.000Z"
    }
  }
}
```

### Error Response Shape

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email, username, or password."
  }
}
```

## 5. Business Rules

- `email` must be unique in the database through a Prisma unique constraint.
- `username` must be unique in the database through a Prisma unique constraint.
- Email must be normalized to lowercase before checking uniqueness and saving.
- Passwords must be hashed with bcrypt before saving to PostgreSQL.
- Never store plain text passwords under any circumstances.
- Do not return `passwordHash`, refresh tokens, JWT secrets, or internal auth metadata to the client.
- JWT payloads must be small and stable, with at least `sub` as the user id.
- `POST /auth/register` and `POST /auth/login` are public APIs.
- `GET /auth/me` is private and must use the JWT guard.
- User id in private APIs must come from the JWT, not from the request body.
- If a user is soft deleted or disabled in the future, login and `/auth/me` must be rejected.
- Login must not reveal whether an identifier exists. Wrong identifier and wrong password must return the same error code, `AUTH_INVALID_CREDENTIALS`.

## 6. Validation Rules

### Register

- `email`:
  - Required.
  - Must be a valid email.
  - Trim and lowercase.
  - Maximum 255 characters.
- `username`:
  - Required.
  - Trim.
  - Length from 3 to 30 characters.
  - Only letters, numbers, `_`, and `.` are allowed.
  - Must not start or end with `.`.
- `password`:
  - Required.
  - Length from 8 to 72 characters to fit bcrypt limits.
  - Must include at least one letter and one number.
- `displayName`:
  - Optional.
  - Trim when provided.
  - Maximum 80 characters.
  - If empty after trimming, the service may use `username` as the display name.

### Login

- `identifier`:
  - Required.
  - Trim.
  - Must not be an empty string.
  - Lowercase before lookup when it has an email format.
- `password`:
  - Required.
  - Must not be an empty string.

### Me

- Must include an `Authorization` header in `Bearer <token>` format.
- Token must be valid, unexpired, and contain the user id in the `sub` claim.
- The user referenced by the token must still exist and be active.

## 7. Error Cases

| Case | HTTP Status | Error Code | Message |
| --- | --- | --- | --- |
| Register body missing required field | 400 | `VALIDATION_ERROR` | `Invalid request body.` |
| Invalid email | 400 | `VALIDATION_ERROR` | `Email must be valid.` |
| Invalid username | 400 | `VALIDATION_ERROR` | `Username format is invalid.` |
| Password does not meet requirements | 400 | `VALIDATION_ERROR` | `Password does not meet requirements.` |
| Email already exists | 409 | `AUTH_EMAIL_TAKEN` | `Email is already registered.` |
| Username already exists | 409 | `AUTH_USERNAME_TAKEN` | `Username is already taken.` |
| Wrong login identifier or password | 401 | `AUTH_INVALID_CREDENTIALS` | `Invalid email, username, or password.` |
| Missing bearer token on `/auth/me` | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| User in token does not exist | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| User disabled or soft deleted | 403 | `AUTH_ACCOUNT_DISABLED` | `Account is not active.` |

## 8. Test Cases

### Register

- Creates a user successfully with valid email, username, and password.
- Normalizes email to lowercase before saving.
- Trims `email`, `username`, and `displayName`.
- Hashes the password with bcrypt and does not store plain text.
- Registration response does not contain `passwordHash`.
- Rejects duplicate email with status 409.
- Rejects duplicate username with status 409.
- Rejects invalid email format with status 400.
- Rejects username that is too short, too long, or contains invalid characters with status 400.
- Rejects password shorter than 8 characters with status 400.
- Rejects password without letters or without numbers with status 400.

### Login

- Logs in successfully with email and correct password.
- Logs in successfully with username and correct password.
- Login still works when the email input has uppercase letters and stored email is normalized.
- Returns a valid access token on successful login.
- Login response does not contain `passwordHash`.
- Rejects wrong password with status 401.
- Rejects unknown identifier with status 401.
- Uses the same error response for unknown identifier and wrong password.
- Rejects soft-deleted or disabled users with status 403 if the status field exists.

### Me

- Returns the current user when a valid JWT is sent.
- Does not return `passwordHash` in `/auth/me`.
- Rejects missing `Authorization` header with status 401.
- Rejects malformed token with status 401.
- Rejects expired token with status 401.
- Rejects a valid token whose user no longer exists with status 401.

### Security and Integration

- `GET /auth/me` must be protected by the JWT guard.
- JWT payload must contain `sub` equal to the user id.
- Auth service must not accept user id from the request body for private APIs.
- Prisma unique constraints must protect against race conditions when two registrations use the same email or username.
- Unit tests should mock Prisma and bcrypt for main business logic.
- E2E tests should use Supertest for `/auth/register`, `/auth/login`, and `/auth/me`.
