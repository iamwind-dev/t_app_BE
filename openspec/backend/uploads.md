# Uploads Module OpenSpec

## 1. Goal

The Uploads module provides image upload APIs for media features in the Flutter
mobile app:

- Images attached to posts.
- Images attached to replies.
- User profile avatar images.

The first phase supports image upload only. The backend may use Cloudinary as
the storage provider, but must not store binary files in PostgreSQL. PostgreSQL
only stores media URLs and required metadata when media is attached to a post,
reply, or user profile.

The module must keep the storage implementation replaceable. Controllers and
services must not leak internal paths, API keys, private upload presets, or
sensitive provider information to the client.

## 2. API

### POST /uploads/image

Uploads one image and returns a safe URL for use in posts, replies, or profile
avatars.

#### Authentication

Private API. JWT is required:

```http
Authorization: Bearer jwt.access.token
```

User id must come from the JWT, not from the request body.

#### Content Type

```http
Content-Type: multipart/form-data
```

#### Form Data

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `file` | file | yes | Image file, maximum 5 MB |
| `type` | string | yes | One of `post`, `reply`, `profile_avatar` |

#### Success Status

`201 Created`

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `secureUrl` | string | HTTPS URL of the uploaded image |
| `publicId` | string | Provider public id for future file management/deletion |
| `type` | string | Validated upload target type |

## 3. Request/Response Samples

### Upload Image for Post

```http
POST /uploads/image
Authorization: Bearer jwt.access.token
Content-Type: multipart/form-data
```

Form data:

```text
file=@post-photo.jpg
type=post
```

Response `201 Created`:

```json
{
  "success": true,
  "data": {
    "upload": {
      "secureUrl": "https://res.cloudinary.com/app/image/upload/v1713970800/uploads/posts/abc123.jpg",
      "publicId": "uploads/posts/abc123",
      "type": "post"
    }
  }
}
```

### Upload Image for Reply

```http
POST /uploads/image
Authorization: Bearer jwt.access.token
Content-Type: multipart/form-data
```

Form data:

```text
file=@reply-image.webp
type=reply
```

Response `201 Created` uses the same upload response shape.

### Upload Profile Avatar

```http
POST /uploads/image
Authorization: Bearer jwt.access.token
Content-Type: multipart/form-data
```

Form data:

```text
file=@avatar.png
type=profile_avatar
```

Response `201 Created` uses the same upload response shape.

### Error Response Shape

```json
{
  "success": false,
  "error": {
    "code": "UPLOAD_INVALID_MIME_TYPE",
    "message": "Only JPEG, PNG, and WebP images are allowed."
  }
}
```

## 4. Business Rules

- `POST /uploads/image` must be protected by a JWT guard.
- Only authenticated users may upload images.
- Service must get user id from the JWT payload and must not trust user id from request body or form data.
- The first phase only allows image upload; video, audio, documents, and archive files are not supported.
- Storage provider may be Cloudinary, but it must be wrapped behind an Uploads service/provider interface so it can be replaced later.
- PostgreSQL must not store binary files.
- PostgreSQL stores only `secureUrl` and required metadata when an image is attached to a post, reply, or user profile.
- The upload endpoint only returns the upload result; attaching `secureUrl` to a post, reply, or avatar is handled by the related module.
- `type` defines a valid folder/storage namespace:
  - `post` for post images.
  - `reply` for reply images.
  - `profile_avatar` for avatars.
- Upload result must include `secureUrl`, `publicId`, and `type`.
- `secureUrl` must be an HTTPS URL.
- Do not return internal storage paths, signed secrets, API keys, Cloudinary secrets, or excess raw provider response data to the client.
- If storage provider upload fails, the API must return a stable error code and must not create a partial database record.
- File names/folders should include user id or a valid namespace for future management, but must not put sensitive information in the public id.
- When a new avatar is attached in the Users module, deleting the old avatar, if needed, is a separate workflow outside the initial upload endpoint.

## 5. Validation Rules

### Authentication

- Request must include an `Authorization` header in `Bearer <token>` format.
- JWT must be valid, unexpired, and include user id in claim `sub`.
- The user referenced by the JWT must still exist and be active.

### Form Data

- Request must use `multipart/form-data`.
- Field `file`:
  - Required.
  - Must not be empty.
  - Maximum size 5 MB.
  - Mime type must be one of:
    - `image/jpeg`
    - `image/png`
    - `image/webp`
  - Extension should match mime type when it can be checked.
- Field `type`:
  - Required.
  - Trim before validation.
  - Only accept `post`, `reply`, or `profile_avatar`.
- Do not accept multiple files in one request in the first phase.
- Do not accept client fields that override user id, arbitrary folders, arbitrary public ids, or sensitive provider options.

### Response Validation

- `secureUrl` must be a valid URL and start with `https://`.
- `publicId` must be a non-empty string.
- Response `type` must match the validated request `type`.

## 6. Error Cases

Error responses should use the shared shape:

```json
{
  "success": false,
  "error": {
    "code": "UPLOAD_FILE_TOO_LARGE",
    "message": "Image size must not exceed 5 MB."
  }
}
```

| Case | HTTP Status | Error Code | Message |
| --- | --- | --- | --- |
| Missing bearer token | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| User does not exist, is soft deleted, or is disabled | 403 | `AUTH_ACCOUNT_DISABLED` | `Account is not active.` |
| Request is not `multipart/form-data` | 400 | `VALIDATION_ERROR` | `Multipart form data is required.` |
| Missing `file` field | 400 | `UPLOAD_FILE_REQUIRED` | `Image file is required.` |
| Empty file | 400 | `UPLOAD_FILE_REQUIRED` | `Image file is required.` |
| More than one file sent | 400 | `UPLOAD_TOO_MANY_FILES` | `Only one image can be uploaded at a time.` |
| File exceeds 5 MB | 413 | `UPLOAD_FILE_TOO_LARGE` | `Image size must not exceed 5 MB.` |
| Unsupported mime type | 400 | `UPLOAD_INVALID_MIME_TYPE` | `Only JPEG, PNG, and WebP images are allowed.` |
| Extension and mime type mismatch | 400 | `UPLOAD_INVALID_FILE` | `Image file is invalid.` |
| Missing `type` field | 400 | `VALIDATION_ERROR` | `Upload type is required.` |
| `type` is not a valid enum value | 400 | `VALIDATION_ERROR` | `Upload type is invalid.` |
| Client sends unsupported user id, public id, folder, or provider option | 400 | `VALIDATION_ERROR` | `Request contains unsupported fields.` |
| Storage provider upload failed | 502 | `UPLOAD_PROVIDER_FAILED` | `Image upload failed. Please try again.` |
| Provider returns invalid or non-HTTPS URL | 502 | `UPLOAD_PROVIDER_FAILED` | `Image upload failed. Please try again.` |

## 7. Test Cases

### POST /uploads/image

- Uploads a JPEG image successfully for `type=post` with a valid JWT.
- Uploads a PNG image successfully for `type=reply` with a valid JWT.
- Uploads a WebP image successfully for `type=profile_avatar` with a valid JWT.
- Success response returns `secureUrl`, `publicId`, and `type`.
- Response `secureUrl` is an HTTPS URL.
- Response does not contain API keys, secrets, internal storage paths, or excess raw provider response.
- Rejects missing JWT with status 401.
- Rejects invalid or expired token with status 401.
- Rejects disabled or soft-deleted user with status 403.
- Rejects non-`multipart/form-data` request with status 400.
- Rejects missing `file` with status 400.
- Rejects empty file with status 400.
- Rejects multiple file upload in one request with status 400.
- Rejects file larger than 5 MB with status 413.
- Rejects mime types other than `image/jpeg`, `image/png`, or `image/webp` with status 400.
- Rejects file extension and mime type mismatch with status 400 when validator supports checking it.
- Rejects missing `type` with status 400.
- Rejects `type` other than `post`, `reply`, and `profile_avatar` with status 400.
- Ensures service gets user id from JWT, not from body or form data.
- Ensures PostgreSQL does not store binary files.
- Ensures upload endpoint does not automatically create posts, replies, or update avatar.
- Mocks storage provider for upload success and provider failure.
- When storage provider errors, API returns 502 with code `UPLOAD_PROVIDER_FAILED`.
- E2E tests use Supertest for `POST /uploads/image` with a valid multipart file and main validation cases.

### Integration

- Uploads controller uses JWT guard and DTO/pipe validation for form data.
- Uploads service wraps the storage provider instead of calling it directly from the controller.
- File size limit is enforced before or inside the upload file interceptor.
- Mime type validation is enforced server-side and does not depend on the Flutter client.
- Posts/Replies/Users modules store media URLs only when the client uses a valid `secureUrl` in the corresponding API.
