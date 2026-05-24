# API Documentation

Tài liệu này được tổng hợp trực tiếp từ source code NestJS hiện tại trong `t_app_BE/src` để đội Flutter dùng khi tích hợp API.

## Tổng quan

- Base URL mặc định theo `.env.example`: `http://localhost:3000`
- Project hiện tại **không có** global prefix `/api` trong `src/main.ts`
- Swagger mặc định: `http://localhost:3000/docs`
- Authentication dùng JWT Bearer token trong header:

```http
Authorization: Bearer <access_token>
```

- Không thấy hệ thống role/permission riêng trong code hiện tại
- Tất cả JSON response thành công đều đi qua `ResponseInterceptor`:

```json
{
  "success": true,
  "data": {}
}
```

- Tất cả lỗi HTTP đều đi qua `HttpExceptionFilter`:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": []
  }
}
```

- Các endpoint dùng cursor pagination trả về:

```json
{
  "pageInfo": {
    "nextCursor": "uuid-or-null",
    "hasNextPage": true
  }
}
```

## [GET] /health

Full URL: `http://localhost:3000/health`  
Controller: `AppController`

### Mô tả
API health check dùng để kiểm tra server đang hoạt động.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### Response lỗi thường gặp
Thông thường không có lỗi nghiệp vụ riêng.

### Ví dụ request
```bash
curl http://localhost:3000/health
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

## [POST] /auth/register

Full URL: `http://localhost:3000/auth/register`  
Controller: `AuthController`

### Mô tả
API dùng để đăng ký tài khoản mới và trả về access token + refresh token.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "email": "alice@example.com",
  "username": "alice_01",
  "password": "Password123",
  "displayName": "Alice"
}
```

### Response thành công
HTTP `201`

```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "alice@example.com",
    "username": "alice_01",
    "displayName": "Alice",
    "avatarUrl": null,
    "createdAt": "2026-05-16T10:00:00.000Z",
    "updatedAt": "2026-05-16T10:00:00.000Z"
  },
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token"
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai format email, username, password |
| 409 | `AUTH_EMAIL_TAKEN` | Email đã tồn tại |
| 409 | `AUTH_USERNAME_TAKEN` | Username đã tồn tại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"alice@example.com\",\"username\":\"alice_01\",\"password\":\"Password123\",\"displayName\":\"Alice\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "email": "alice@example.com",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null,
      "createdAt": "2026-05-16T10:00:00.000Z",
      "updatedAt": "2026-05-16T10:00:00.000Z"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "refresh_token"
  }
}
```

## [POST] /auth/login

Full URL: `http://localhost:3000/auth/login`  
Controller: `AuthController`

### Mô tả
API dùng để đăng nhập bằng email hoặc username.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "identifier": "alice@example.com",
  "password": "Password123"
}
```

### Response thành công
HTTP `200`

```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "alice@example.com",
    "username": "alice_01",
    "displayName": "Alice",
    "avatarUrl": null,
    "createdAt": "2026-05-16T10:00:00.000Z",
    "updatedAt": "2026-05-16T10:00:00.000Z"
  },
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token"
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu `identifier` hoặc `password` |
| 401 | `AUTH_INVALID_CREDENTIALS` | Sai email/username hoặc password |
| 403 | `AUTH_ACCOUNT_DISABLED` | Tài khoản không còn active |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"alice@example.com\",\"password\":\"Password123\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "email": "alice@example.com",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null,
      "createdAt": "2026-05-16T10:00:00.000Z",
      "updatedAt": "2026-05-16T10:00:00.000Z"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "refresh_token"
  }
}
```

## [POST] /auth/refresh

Full URL: `http://localhost:3000/auth/refresh`  
Controller: `AuthController`

### Mô tả
API dùng để đổi refresh token cũ lấy cặp token mới.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "refreshToken": "current_refresh_token"
}
```

### Response thành công
HTTP `200`

```json
{
  "accessToken": "new_access_token",
  "refreshToken": "new_refresh_token"
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu hoặc sai format `refreshToken` |
| 401 | `AUTH_INVALID_REFRESH_TOKEN` | Refresh token không hợp lệ, hết hạn hoặc đã revoke |
| 403 | `AUTH_ACCOUNT_DISABLED` | User của token không còn active |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"current_refresh_token\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

## [POST] /auth/logout

Full URL: `http://localhost:3000/auth/logout`  
Controller: `AuthController`

### Mô tả
API dùng để revoke refresh token hiện tại.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "refreshToken": "current_refresh_token"
}
```

### Response thành công
HTTP `200`

```json
{
  "loggedOut": true
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu hoặc sai format `refreshToken` |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"current_refresh_token\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

## [POST] /auth/change-password

Full URL: `http://localhost:3000/auth/change-password`  
Controller: `AuthController`

### Mô tả
API dùng để đổi mật khẩu và revoke toàn bộ refresh token đang còn hiệu lực.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "currentPassword": "Password123",
  "newPassword": "NewPassword123"
}
```

### Response thành công
HTTP `200`

```json
{
  "changed": true
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Mật khẩu mới không đạt rule |
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 401 | `AUTH_INVALID_TOKEN` | Token không hợp lệ/hết hạn |
| 401 | `AUTH_INVALID_CURRENT_PASSWORD` | Sai mật khẩu hiện tại |
| 403 | `AUTH_ACCOUNT_DISABLED` | Tài khoản không còn active |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"Password123\",\"newPassword\":\"NewPassword123\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "changed": true
  }
}
```

## [GET] /auth/me

Full URL: `http://localhost:3000/auth/me`  
Controller: `AuthController`

### Mô tả
API lấy thông tin user hiện tại từ access token.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "alice@example.com",
    "username": "alice_01",
    "displayName": "Alice",
    "avatarUrl": null,
    "createdAt": "2026-05-16T10:00:00.000Z",
    "updatedAt": "2026-05-16T10:00:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 401 | `AUTH_INVALID_TOKEN` | Token không hợp lệ/hết hạn |
| 403 | `AUTH_ACCOUNT_DISABLED` | Tài khoản không còn active |

### Ví dụ request
```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "email": "alice@example.com",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null,
      "createdAt": "2026-05-16T10:00:00.000Z",
      "updatedAt": "2026-05-16T10:00:00.000Z"
    }
  }
}
```

## [GET] /users/username/:username

Full URL: `http://localhost:3000/users/username/{username}`  
Controller: `UsersController`

### Mô tả
API lấy public profile theo username. Có thể gửi Bearer token tùy chọn để backend tính `isFollowing`.

### Authentication
Required: No  
Bearer Token: Optional  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | Yes | Username, 3-30 ký tự, regex `[A-Za-z0-9_.]+` |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "user": {
    "id": "22222222-2222-4222-8222-222222222222",
    "username": "bob",
    "displayName": "Bob",
    "bio": "Mobile engineer",
    "avatarUrl": "https://cdn.example.com/avatar.jpg",
    "followersCount": 120,
    "followingCount": 55,
    "postCount": 30,
    "isFollowing": true,
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-16T08:00:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Username sai format |
| 404 | `USER_NOT_FOUND` | Không tìm thấy user active |

### Ví dụ request
```bash
curl http://localhost:3000/users/username/bob
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "username": "bob",
      "displayName": "Bob",
      "bio": "Mobile engineer",
      "avatarUrl": "https://cdn.example.com/avatar.jpg",
      "followersCount": 120,
      "followingCount": 55,
      "postCount": 30,
      "isFollowing": false,
      "createdAt": "2026-05-01T08:00:00.000Z",
      "updatedAt": "2026-05-16T08:00:00.000Z"
    }
  }
}
```

## [PATCH] /users/me

Full URL: `http://localhost:3000/users/me`  
Controller: `UsersController`

### Mô tả
API cập nhật profile của user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "username": "alice_new",
  "displayName": "Alice Nguyen",
  "bio": "Flutter + Backend",
  "avatarUrl": "https://cdn.example.com/avatar-new.jpg"
}
```

### Response thành công
HTTP `200`

```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "username": "alice_new",
    "displayName": "Alice Nguyen",
    "bio": "Flutter + Backend",
    "avatarUrl": "https://cdn.example.com/avatar-new.jpg",
    "followersCount": 10,
    "followingCount": 8,
    "postCount": 4,
    "isFollowing": false,
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-16T10:30:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body rỗng hoặc field sai format |
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 404 | `USER_NOT_FOUND` | User trong token không tồn tại/không active |
| 409 | `USER_USERNAME_TAKEN` | Username mới đã bị dùng |

### Ví dụ request
```bash
curl -X PATCH http://localhost:3000/users/me \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"displayName\":\"Alice Nguyen\",\"bio\":\"Flutter + Backend\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "username": "alice_01",
      "displayName": "Alice Nguyen",
      "bio": "Flutter + Backend",
      "avatarUrl": null,
      "followersCount": 10,
      "followingCount": 8,
      "postCount": 4,
      "isFollowing": false,
      "createdAt": "2026-05-01T08:00:00.000Z",
      "updatedAt": "2026-05-16T10:30:00.000Z"
    }
  }
}
```

## [GET] /users/:id/posts

Full URL: `http://localhost:3000/users/{id}/posts`  
Controller: `UsersController`

### Mô tả
API lấy danh sách bài viết của một user.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | User ID |

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | 1-50, mặc định `20` |
| `cursor` | uuid | No | Cursor phân trang |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "author": {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "content": "Hello Threads",
      "mediaUrls": [],
      "replyCount": 3,
      "reactionCount": 12,
      "moderationStatus": "approved",
      "createdAt": "2026-05-16T09:00:00.000Z",
      "updatedAt": "2026-05-16T09:00:00.000Z"
    }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai `id`, `limit` hoặc `cursor` |
| 404 | `USER_NOT_FOUND` | User không tồn tại/không active |

### Ví dụ request
```bash
curl "http://localhost:3000/users/22222222-2222-4222-8222-222222222222/posts?limit=20"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "author": {
          "id": "22222222-2222-4222-8222-222222222222",
          "username": "bob",
          "displayName": "Bob",
          "avatarUrl": "https://cdn.example.com/avatar.jpg"
        },
        "content": "Hello Threads",
        "mediaUrls": [],
        "replyCount": 3,
        "reactionCount": 12,
        "moderationStatus": "approved",
        "createdAt": "2026-05-16T09:00:00.000Z",
        "updatedAt": "2026-05-16T09:00:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## [GET] /users/:id

Full URL: `http://localhost:3000/users/{id}`  
Controller: `UsersController`

### Mô tả
API lấy public profile theo user id. Có thể gửi Bearer token tùy chọn để backend tính `isFollowing`.

### Authentication
Required: No  
Bearer Token: Optional  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | User ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "user": {
    "id": "22222222-2222-4222-8222-222222222222",
    "username": "bob",
    "displayName": "Bob",
    "bio": "Mobile engineer",
    "avatarUrl": "https://cdn.example.com/avatar.jpg",
    "followersCount": 120,
    "followingCount": 55,
    "postCount": 30,
    "isFollowing": true,
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-16T08:00:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai format `id` |
| 404 | `USER_NOT_FOUND` | User không tồn tại/không active |

### Ví dụ request
```bash
curl http://localhost:3000/users/22222222-2222-4222-8222-222222222222
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "username": "bob",
      "displayName": "Bob",
      "bio": "Mobile engineer",
      "avatarUrl": "https://cdn.example.com/avatar.jpg",
      "followersCount": 120,
      "followingCount": 55,
      "postCount": 30,
      "isFollowing": false,
      "createdAt": "2026-05-01T08:00:00.000Z",
      "updatedAt": "2026-05-16T08:00:00.000Z"
    }
  }
}
```

## [POST] /users/:id/follow

Full URL: `http://localhost:3000/users/{id}/follow`  
Controller: `FollowsController`

### Mô tả
API follow một user khác. Nếu đã follow trước đó thì trả về profile hiện tại của target user.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Target user ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "user": {
    "id": "22222222-2222-4222-8222-222222222222",
    "username": "bob",
    "displayName": "Bob",
    "bio": "Mobile engineer",
    "avatarUrl": "https://cdn.example.com/avatar.jpg",
    "followersCount": 121,
    "followingCount": 55,
    "postCount": 30,
    "isFollowing": true,
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-16T08:00:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `FOLLOW_SELF_NOT_ALLOWED` | Follow chính mình |
| 404 | `USER_NOT_FOUND` | Target user không tồn tại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/users/22222222-2222-4222-8222-222222222222/follow \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "username": "bob",
      "displayName": "Bob",
      "bio": "Mobile engineer",
      "avatarUrl": "https://cdn.example.com/avatar.jpg",
      "followersCount": 121,
      "followingCount": 55,
      "postCount": 30,
      "isFollowing": true,
      "createdAt": "2026-05-01T08:00:00.000Z",
      "updatedAt": "2026-05-16T08:00:00.000Z"
    }
  }
}
```

## [DELETE] /users/:id/follow

Full URL: `http://localhost:3000/users/{id}/follow`  
Controller: `FollowsController`

### Mô tả
API unfollow một user. Nếu chưa follow thì vẫn trả về profile target user.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Target user ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "user": {
    "id": "22222222-2222-4222-8222-222222222222",
    "username": "bob",
    "displayName": "Bob",
    "bio": "Mobile engineer",
    "avatarUrl": "https://cdn.example.com/avatar.jpg",
    "followersCount": 120,
    "followingCount": 55,
    "postCount": 30,
    "isFollowing": false,
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-16T08:00:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `FOLLOW_SELF_NOT_ALLOWED` | Unfollow chính mình |
| 404 | `USER_NOT_FOUND` | Target user không tồn tại |

### Ví dụ request
```bash
curl -X DELETE http://localhost:3000/users/22222222-2222-4222-8222-222222222222/follow \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "username": "bob",
      "displayName": "Bob",
      "bio": "Mobile engineer",
      "avatarUrl": "https://cdn.example.com/avatar.jpg",
      "followersCount": 120,
      "followingCount": 55,
      "postCount": 30,
      "isFollowing": false,
      "createdAt": "2026-05-01T08:00:00.000Z",
      "updatedAt": "2026-05-16T08:00:00.000Z"
    }
  }
}
```

## [GET] /users/:id/followers

Full URL: `http://localhost:3000/users/{id}/followers`  
Controller: `FollowsController`

### Mô tả
API lấy danh sách followers của một user. Bearer token là tùy chọn để tính `isFollowing`.

### Authentication
Required: No  
Bearer Token: Optional  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | User ID |

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | 1-50, mặc định `20` |
| `cursor` | uuid | No | Cursor phân trang |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "username": "charlie",
      "displayName": "Charlie",
      "avatarUrl": null,
      "bio": "Backend dev",
      "followersCount": 12,
      "followingCount": 4,
      "isFollowing": false,
      "followedAt": "2026-05-16T07:00:00.000Z"
    }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai `id`, `limit`, `cursor` |
| 404 | `USER_NOT_FOUND` | User không tồn tại |

### Ví dụ request
```bash
curl "http://localhost:3000/users/22222222-2222-4222-8222-222222222222/followers?limit=20"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "99999999-9999-4999-8999-999999999999",
        "username": "charlie",
        "displayName": "Charlie",
        "avatarUrl": null,
        "bio": "Backend dev",
        "followersCount": 12,
        "followingCount": 4,
        "isFollowing": false,
        "followedAt": "2026-05-16T07:00:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## [GET] /users/:id/following

Full URL: `http://localhost:3000/users/{id}/following`  
Controller: `FollowsController`

### Mô tả
API lấy danh sách user mà một user đang follow. Bearer token là tùy chọn để tính `isFollowing`.

### Authentication
Required: No  
Bearer Token: Optional  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | User ID |

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | 1-50, mặc định `20` |
| `cursor` | uuid | No | Cursor phân trang |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "username": "bob",
      "displayName": "Bob",
      "avatarUrl": "https://cdn.example.com/avatar.jpg",
      "bio": "Mobile engineer",
      "followersCount": 120,
      "followingCount": 55,
      "isFollowing": true,
      "followedAt": "2026-05-10T07:00:00.000Z"
    }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai `id`, `limit`, `cursor` |
| 404 | `USER_NOT_FOUND` | User không tồn tại |

### Ví dụ request
```bash
curl "http://localhost:3000/users/11111111-1111-4111-8111-111111111111/following?limit=20"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg",
        "bio": "Mobile engineer",
        "followersCount": 120,
        "followingCount": 55,
        "isFollowing": true,
        "followedAt": "2026-05-10T07:00:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## [POST] /posts

Full URL: `http://localhost:3000/posts`  
Controller: `PostsController`

### Mô tả
API tạo bài viết mới. Bài viết được AI moderation trước khi lưu.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "content": "Hello from Flutter",
  "mediaUrls": [
    "https://cdn.example.com/post-1.jpg"
  ]
}
```

### Response thành công
HTTP `201`

```json
{
  "post": {
    "id": "33333333-3333-4333-8333-333333333333",
    "content": "Hello from Flutter",
    "mediaUrls": [
      "https://cdn.example.com/post-1.jpg"
    ],
    "moderationStatus": "safe",
    "visibilityLevel": "normal",
    "toxicityScore": 0.02,
    "moderationCategories": [],
    "moderationMessage": "",
    "moderationHighlights": [],
    "moderationSuggestion": "",
    "moderationModel": "model-v1",
    "aiReviewedAt": "2026-05-16T10:40:00.000Z",
    "createdAt": "2026-05-16T10:40:00.000Z",
    "author": {
      "id": "11111111-1111-4111-8111-111111111111",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null
    },
    "likeCount": 0,
    "replyCount": 0,
    "isLikedByMe": false
  },
  "moderation": {
    "label": "SAFE",
    "toxicityScore": 0.02,
    "categories": [],
    "message": "",
    "highlights": [],
    "suggestion": "",
    "model": "model-v1",
    "visibilityLevel": "NORMAL"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Không có content và media, hoặc field sai format |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Hello from Flutter\",\"mediaUrls\":[\"https://cdn.example.com/post-1.jpg\"]}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "post": {
      "id": "33333333-3333-4333-8333-333333333333",
      "content": "Hello from Flutter",
      "mediaUrls": [
        "https://cdn.example.com/post-1.jpg"
      ],
      "moderationStatus": "safe",
      "visibilityLevel": "normal",
      "toxicityScore": 0.02,
      "moderationCategories": [],
      "moderationMessage": "",
      "moderationHighlights": [],
      "moderationSuggestion": "",
      "moderationModel": "model-v1",
      "aiReviewedAt": "2026-05-16T10:40:00.000Z",
      "createdAt": "2026-05-16T10:40:00.000Z",
      "author": {
        "id": "11111111-1111-4111-8111-111111111111",
        "username": "alice_01",
        "displayName": "Alice",
        "avatarUrl": null
      },
      "likeCount": 0,
      "replyCount": 0,
      "isLikedByMe": false
    },
    "moderation": {
      "label": "SAFE",
      "toxicityScore": 0.02,
      "categories": [],
      "message": "",
      "highlights": [],
      "suggestion": "",
      "model": "model-v1",
      "visibilityLevel": "NORMAL"
    }
  }
}
```

## [GET] /posts/feed

Full URL: `http://localhost:3000/posts/feed`  
Controller: `PostsController`

### Mô tả
API lấy feed bài viết mới nhất cho user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `cursor` | uuid | No | Cursor phân trang |
| `limit` | number | No | 1-50, mặc định `20` |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "content": "Hello from Flutter",
      "mediaUrls": [],
      "moderationStatus": "approved",
      "visibilityLevel": "normal",
      "toxicityScore": null,
      "moderationCategories": [],
      "moderationMessage": null,
      "moderationHighlights": null,
      "moderationSuggestion": null,
      "moderationModel": null,
      "aiReviewedAt": null,
      "createdAt": "2026-05-16T10:40:00.000Z",
      "author": {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "likeCount": 12,
      "replyCount": 3,
      "isLikedByMe": true
    }
  ],
  "pageInfo": {
    "nextCursor": "33333333-3333-4333-8333-333333333333",
    "hasNextPage": true
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai `cursor` hoặc `limit` |

### Ví dụ request
```bash
curl "http://localhost:3000/posts/feed?limit=20" \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "content": "Hello from Flutter",
        "mediaUrls": [],
        "moderationStatus": "approved",
        "visibilityLevel": "normal",
        "toxicityScore": null,
        "moderationCategories": [],
        "moderationMessage": null,
        "moderationHighlights": null,
        "moderationSuggestion": null,
        "moderationModel": null,
        "aiReviewedAt": null,
        "createdAt": "2026-05-16T10:40:00.000Z",
        "author": {
          "id": "22222222-2222-4222-8222-222222222222",
          "username": "bob",
          "displayName": "Bob",
          "avatarUrl": "https://cdn.example.com/avatar.jpg"
        },
        "likeCount": 12,
        "replyCount": 3,
        "isLikedByMe": true
      }
    ],
    "pageInfo": {
      "nextCursor": "33333333-3333-4333-8333-333333333333",
      "hasNextPage": true
    }
  }
}
```

## [GET] /posts/:id

Full URL: `http://localhost:3000/posts/{id}`  
Controller: `PostsController`

### Mô tả
API lấy chi tiết một bài viết.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Post ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "post": {
    "id": "33333333-3333-4333-8333-333333333333",
    "content": "Hello from Flutter",
    "mediaUrls": [],
    "moderationStatus": "approved",
    "visibilityLevel": "normal",
    "toxicityScore": null,
    "moderationCategories": [],
    "moderationMessage": null,
    "moderationHighlights": null,
    "moderationSuggestion": null,
    "moderationModel": null,
    "aiReviewedAt": null,
    "createdAt": "2026-05-16T10:40:00.000Z",
    "author": {
      "id": "22222222-2222-4222-8222-222222222222",
      "username": "bob",
      "displayName": "Bob",
      "avatarUrl": "https://cdn.example.com/avatar.jpg"
    },
    "likeCount": 12,
    "replyCount": 3,
    "isLikedByMe": true
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai format `id` |
| 404 | `POST_NOT_FOUND` | Post đã xóa hoặc không tồn tại |

### Ví dụ request
```bash
curl http://localhost:3000/posts/33333333-3333-4333-8333-333333333333 \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "post": {
      "id": "33333333-3333-4333-8333-333333333333",
      "content": "Hello from Flutter",
      "mediaUrls": [],
      "moderationStatus": "approved",
      "visibilityLevel": "normal",
      "toxicityScore": null,
      "moderationCategories": [],
      "moderationMessage": null,
      "moderationHighlights": null,
      "moderationSuggestion": null,
      "moderationModel": null,
      "aiReviewedAt": null,
      "createdAt": "2026-05-16T10:40:00.000Z",
      "author": {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "likeCount": 12,
      "replyCount": 3,
      "isLikedByMe": true
    }
  }
}
```

## [PATCH] /posts/:id

Full URL: `http://localhost:3000/posts/{id}`  
Controller: `PostsController`

### Mô tả
API cập nhật bài viết của chính user đang đăng nhập.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Post ID |

### Request Query
Không có.

### Request Body
```json
{
  "content": "Updated content",
  "mediaUrls": [
    "https://cdn.example.com/post-updated.jpg"
  ]
}
```

### Response thành công
HTTP `200`

```json
{
  "post": {
    "id": "33333333-3333-4333-8333-333333333333",
    "content": "Updated content",
    "mediaUrls": [
      "https://cdn.example.com/post-updated.jpg"
    ],
    "moderationStatus": "approved",
    "visibilityLevel": "normal",
    "toxicityScore": null,
    "moderationCategories": [],
    "moderationMessage": null,
    "moderationHighlights": null,
    "moderationSuggestion": null,
    "moderationModel": null,
    "aiReviewedAt": null,
    "createdAt": "2026-05-16T10:40:00.000Z",
    "author": {
      "id": "11111111-1111-4111-8111-111111111111",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null
    },
    "likeCount": 0,
    "replyCount": 0,
    "isLikedByMe": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Body rỗng hoặc sau update không còn content/media |
| 403 | `POST_FORBIDDEN` | Không phải tác giả post |
| 404 | `POST_NOT_FOUND` | Post không tồn tại |

### Ví dụ request
```bash
curl -X PATCH http://localhost:3000/posts/33333333-3333-4333-8333-333333333333 \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Updated content\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "post": {
      "id": "33333333-3333-4333-8333-333333333333",
      "content": "Updated content",
      "mediaUrls": [],
      "moderationStatus": "approved",
      "visibilityLevel": "normal",
      "toxicityScore": null,
      "moderationCategories": [],
      "moderationMessage": null,
      "moderationHighlights": null,
      "moderationSuggestion": null,
      "moderationModel": null,
      "aiReviewedAt": null,
      "createdAt": "2026-05-16T10:40:00.000Z",
      "author": {
        "id": "11111111-1111-4111-8111-111111111111",
        "username": "alice_01",
        "displayName": "Alice",
        "avatarUrl": null
      },
      "likeCount": 0,
      "replyCount": 0,
      "isLikedByMe": false
    }
  }
}
```

## [DELETE] /posts/:id

Full URL: `http://localhost:3000/posts/{id}`  
Controller: `PostsController`

### Mô tả
API soft delete bài viết của chính user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Post ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "deleted": true,
  "id": "33333333-3333-4333-8333-333333333333",
  "deletedAt": "2026-05-16T11:00:00.000Z"
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 403 | `POST_FORBIDDEN` | Không phải tác giả post |
| 404 | `POST_NOT_FOUND` | Post không tồn tại |

### Ví dụ request
```bash
curl -X DELETE http://localhost:3000/posts/33333333-3333-4333-8333-333333333333 \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "33333333-3333-4333-8333-333333333333",
    "deletedAt": "2026-05-16T11:00:00.000Z"
  }
}
```

## [POST] /posts/:postId/replies

Full URL: `http://localhost:3000/posts/{postId}/replies`  
Controller: `RepliesController`

### Mô tả
API tạo reply trực tiếp cho một post.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `postId` | uuid | Yes | Post ID |

### Request Query
Không có.

### Request Body
```json
{
  "content": "Nice post",
  "mediaUrls": []
}
```

### Response thành công
HTTP `201`

```json
{
  "reply": {
    "id": "44444444-4444-4444-8444-444444444444",
    "postId": "33333333-3333-4333-8333-333333333333",
    "parentReplyId": null,
    "author": {
      "id": "11111111-1111-4111-8111-111111111111",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null
    },
    "content": "Nice post",
    "mediaUrls": [],
    "likeCount": 0,
    "childReplyCount": 0,
    "moderationStatus": "approved",
    "createdAt": "2026-05-16T11:05:00.000Z",
    "isLikedByMe": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Không có content và media hoặc sai field |
| 404 | `POST_NOT_FOUND` | Post không tồn tại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/posts/33333333-3333-4333-8333-333333333333/replies \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Nice post\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "reply": {
      "id": "44444444-4444-4444-8444-444444444444",
      "postId": "33333333-3333-4333-8333-333333333333",
      "parentReplyId": null,
      "author": {
        "id": "11111111-1111-4111-8111-111111111111",
        "username": "alice_01",
        "displayName": "Alice",
        "avatarUrl": null
      },
      "content": "Nice post",
      "mediaUrls": [],
      "likeCount": 0,
      "childReplyCount": 0,
      "moderationStatus": "approved",
      "createdAt": "2026-05-16T11:05:00.000Z",
      "isLikedByMe": false
    }
  }
}
```

## [POST] /replies/:replyId/replies

Full URL: `http://localhost:3000/replies/{replyId}/replies`  
Controller: `RepliesController`

### Mô tả
API tạo child reply cho một reply khác.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `replyId` | uuid | Yes | Parent reply ID |

### Request Query
Không có.

### Request Body
```json
{
  "content": "Reply to reply",
  "mediaUrls": []
}
```

### Response thành công
HTTP `201`

```json
{
  "reply": {
    "id": "45454545-4545-4545-8545-454545454545",
    "postId": "33333333-3333-4333-8333-333333333333",
    "parentReplyId": "44444444-4444-4444-8444-444444444444",
    "author": {
      "id": "11111111-1111-4111-8111-111111111111",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null
    },
    "content": "Reply to reply",
    "mediaUrls": [],
    "likeCount": 0,
    "childReplyCount": 0,
    "moderationStatus": "approved",
    "createdAt": "2026-05-16T11:10:00.000Z",
    "isLikedByMe": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Không có content và media hoặc sai field |
| 404 | `REPLY_NOT_FOUND` | Parent reply không tồn tại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/replies/44444444-4444-4444-8444-444444444444/replies \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Reply to reply\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "reply": {
      "id": "45454545-4545-4545-8545-454545454545",
      "postId": "33333333-3333-4333-8333-333333333333",
      "parentReplyId": "44444444-4444-4444-8444-444444444444",
      "author": {
        "id": "11111111-1111-4111-8111-111111111111",
        "username": "alice_01",
        "displayName": "Alice",
        "avatarUrl": null
      },
      "content": "Reply to reply",
      "mediaUrls": [],
      "likeCount": 0,
      "childReplyCount": 0,
      "moderationStatus": "approved",
      "createdAt": "2026-05-16T11:10:00.000Z",
      "isLikedByMe": false
    }
  }
}
```

## [GET] /posts/:postId/replies

Full URL: `http://localhost:3000/posts/{postId}/replies`  
Controller: `RepliesController`

### Mô tả
API lấy danh sách reply cấp 1 của một post. Bearer token là tùy chọn để tính `isLikedByMe`.

### Authentication
Required: No  
Bearer Token: Optional  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `postId` | uuid | Yes | Post ID |

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | 1-50, mặc định `20` |
| `cursor` | uuid | No | Cursor phân trang |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "postId": "33333333-3333-4333-8333-333333333333",
      "parentReplyId": null,
      "author": {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "content": "Nice post",
      "mediaUrls": [],
      "likeCount": 2,
      "childReplyCount": 1,
      "moderationStatus": "approved",
      "createdAt": "2026-05-16T11:05:00.000Z",
      "isLikedByMe": true
    }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai `postId`, `limit`, `cursor` |
| 404 | `POST_NOT_FOUND` | Post không tồn tại |

### Ví dụ request
```bash
curl "http://localhost:3000/posts/33333333-3333-4333-8333-333333333333/replies?limit=20"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "44444444-4444-4444-8444-444444444444",
        "postId": "33333333-3333-4333-8333-333333333333",
        "parentReplyId": null,
        "author": {
          "id": "22222222-2222-4222-8222-222222222222",
          "username": "bob",
          "displayName": "Bob",
          "avatarUrl": "https://cdn.example.com/avatar.jpg"
        },
        "content": "Nice post",
        "mediaUrls": [],
        "likeCount": 2,
        "childReplyCount": 1,
        "moderationStatus": "approved",
        "createdAt": "2026-05-16T11:05:00.000Z",
        "isLikedByMe": false
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## [GET] /replies/:replyId/children

Full URL: `http://localhost:3000/replies/{replyId}/children`  
Controller: `RepliesController`

### Mô tả
API lấy danh sách child replies của một reply.

### Authentication
Required: No  
Bearer Token: Optional  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `replyId` | uuid | Yes | Reply ID |

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | 1-50, mặc định `20` |
| `cursor` | uuid | No | Cursor phân trang |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "45454545-4545-4545-8545-454545454545",
      "postId": "33333333-3333-4333-8333-333333333333",
      "parentReplyId": "44444444-4444-4444-8444-444444444444",
      "author": {
        "id": "11111111-1111-4111-8111-111111111111",
        "username": "alice_01",
        "displayName": "Alice",
        "avatarUrl": null
      },
      "content": "Reply to reply",
      "mediaUrls": [],
      "likeCount": 0,
      "childReplyCount": 0,
      "moderationStatus": "approved",
      "createdAt": "2026-05-16T11:10:00.000Z",
      "isLikedByMe": false
    }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai `replyId`, `limit`, `cursor` |
| 404 | `REPLY_NOT_FOUND` | Reply không tồn tại |

### Ví dụ request
```bash
curl "http://localhost:3000/replies/44444444-4444-4444-8444-444444444444/children?limit=20"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "45454545-4545-4545-8545-454545454545",
        "postId": "33333333-3333-4333-8333-333333333333",
        "parentReplyId": "44444444-4444-4444-8444-444444444444",
        "author": {
          "id": "11111111-1111-4111-8111-111111111111",
          "username": "alice_01",
          "displayName": "Alice",
          "avatarUrl": null
        },
        "content": "Reply to reply",
        "mediaUrls": [],
        "likeCount": 0,
        "childReplyCount": 0,
        "moderationStatus": "approved",
        "createdAt": "2026-05-16T11:10:00.000Z",
        "isLikedByMe": false
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## [GET] /replies/:replyId

Full URL: `http://localhost:3000/replies/{replyId}`  
Controller: `RepliesController`

### Mô tả
API lấy chi tiết một reply.

### Authentication
Required: No  
Bearer Token: Optional  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `replyId` | uuid | Yes | Reply ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "reply": {
    "id": "44444444-4444-4444-8444-444444444444",
    "postId": "33333333-3333-4333-8333-333333333333",
    "parentReplyId": null,
    "author": {
      "id": "22222222-2222-4222-8222-222222222222",
      "username": "bob",
      "displayName": "Bob",
      "avatarUrl": "https://cdn.example.com/avatar.jpg"
    },
    "content": "Nice post",
    "mediaUrls": [],
    "likeCount": 2,
    "childReplyCount": 1,
    "moderationStatus": "approved",
    "createdAt": "2026-05-16T11:05:00.000Z",
    "isLikedByMe": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai format `replyId` |
| 404 | `REPLY_NOT_FOUND` | Reply không tồn tại |

### Ví dụ request
```bash
curl http://localhost:3000/replies/44444444-4444-4444-8444-444444444444
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "reply": {
      "id": "44444444-4444-4444-8444-444444444444",
      "postId": "33333333-3333-4333-8333-333333333333",
      "parentReplyId": null,
      "author": {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "content": "Nice post",
      "mediaUrls": [],
      "likeCount": 2,
      "childReplyCount": 1,
      "moderationStatus": "approved",
      "createdAt": "2026-05-16T11:05:00.000Z",
      "isLikedByMe": false
    }
  }
}
```

## [PATCH] /replies/:replyId

Full URL: `http://localhost:3000/replies/{replyId}`  
Controller: `RepliesController`

### Mô tả
API cập nhật reply của chính user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `replyId` | uuid | Yes | Reply ID |

### Request Query
Không có.

### Request Body
```json
{
  "content": "Updated reply",
  "mediaUrls": []
}
```

### Response thành công
HTTP `200`

```json
{
  "reply": {
    "id": "44444444-4444-4444-8444-444444444444",
    "postId": "33333333-3333-4333-8333-333333333333",
    "parentReplyId": null,
    "author": {
      "id": "11111111-1111-4111-8111-111111111111",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null
    },
    "content": "Updated reply",
    "mediaUrls": [],
    "likeCount": 0,
    "childReplyCount": 0,
    "moderationStatus": "approved",
    "createdAt": "2026-05-16T11:05:00.000Z",
    "isLikedByMe": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Body rỗng hoặc sau update không còn content/media |
| 403 | `REPLY_FORBIDDEN` | Không phải tác giả reply |
| 404 | `REPLY_NOT_FOUND` | Reply không tồn tại |

### Ví dụ request
```bash
curl -X PATCH http://localhost:3000/replies/44444444-4444-4444-8444-444444444444 \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Updated reply\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "reply": {
      "id": "44444444-4444-4444-8444-444444444444",
      "postId": "33333333-3333-4333-8333-333333333333",
      "parentReplyId": null,
      "author": {
        "id": "11111111-1111-4111-8111-111111111111",
        "username": "alice_01",
        "displayName": "Alice",
        "avatarUrl": null
      },
      "content": "Updated reply",
      "mediaUrls": [],
      "likeCount": 0,
      "childReplyCount": 0,
      "moderationStatus": "approved",
      "createdAt": "2026-05-16T11:05:00.000Z",
      "isLikedByMe": false
    }
  }
}
```

## [DELETE] /replies/:replyId

Full URL: `http://localhost:3000/replies/{replyId}`  
Controller: `RepliesController`

### Mô tả
API soft delete một reply của chính user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `replyId` | uuid | Yes | Reply ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "deleted": true,
  "id": "44444444-4444-4444-8444-444444444444",
  "deletedAt": "2026-05-16T11:20:00.000Z"
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 403 | `REPLY_FORBIDDEN` | Không phải tác giả reply |
| 404 | `REPLY_NOT_FOUND` | Reply không tồn tại |

### Ví dụ request
```bash
curl -X DELETE http://localhost:3000/replies/44444444-4444-4444-8444-444444444444 \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "44444444-4444-4444-8444-444444444444",
    "deletedAt": "2026-05-16T11:20:00.000Z"
  }
}
```

## [POST] /posts/:postId/like

Full URL: `http://localhost:3000/posts/{postId}/like`  
Controller: `ReactionsController`

### Mô tả
API like một post. Nếu đã like rồi thì trả về state hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `postId` | uuid | Yes | Post ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "postId": "33333333-3333-4333-8333-333333333333",
  "likeCount": 13,
  "isLiked": true
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai format `postId` |
| 404 | `REACTION_TARGET_NOT_FOUND` | Post không tồn tại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/posts/33333333-3333-4333-8333-333333333333/like \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "postId": "33333333-3333-4333-8333-333333333333",
    "likeCount": 13,
    "isLiked": true
  }
}
```

## [DELETE] /posts/:postId/like

Full URL: `http://localhost:3000/posts/{postId}/like`  
Controller: `ReactionsController`

### Mô tả
API unlike một post. Nếu chưa like thì trả về state hiện tại với `isLiked=false`.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `postId` | uuid | Yes | Post ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "postId": "33333333-3333-4333-8333-333333333333",
  "likeCount": 12,
  "isLiked": false
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai format `postId` |
| 404 | `REACTION_TARGET_NOT_FOUND` | Post không tồn tại |

### Ví dụ request
```bash
curl -X DELETE http://localhost:3000/posts/33333333-3333-4333-8333-333333333333/like \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "postId": "33333333-3333-4333-8333-333333333333",
    "likeCount": 12,
    "isLiked": false
  }
}
```

## [POST] /replies/:replyId/like

Full URL: `http://localhost:3000/replies/{replyId}/like`  
Controller: `ReactionsController`

### Mô tả
API like một reply.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `replyId` | uuid | Yes | Reply ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "replyId": "44444444-4444-4444-8444-444444444444",
  "likeCount": 3,
  "isLiked": true
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai format `replyId` |
| 404 | `REACTION_TARGET_NOT_FOUND` | Reply không tồn tại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/replies/44444444-4444-4444-8444-444444444444/like \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "replyId": "44444444-4444-4444-8444-444444444444",
    "likeCount": 3,
    "isLiked": true
  }
}
```

## [DELETE] /replies/:replyId/like

Full URL: `http://localhost:3000/replies/{replyId}/like`  
Controller: `ReactionsController`

### Mô tả
API unlike một reply.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `replyId` | uuid | Yes | Reply ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "replyId": "44444444-4444-4444-8444-444444444444",
  "likeCount": 2,
  "isLiked": false
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai format `replyId` |
| 404 | `REACTION_TARGET_NOT_FOUND` | Reply không tồn tại |

### Ví dụ request
```bash
curl -X DELETE http://localhost:3000/replies/44444444-4444-4444-8444-444444444444/like \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "replyId": "44444444-4444-4444-8444-444444444444",
    "likeCount": 2,
    "isLiked": false
  }
}
```

## [POST] /conversations/direct/:userId

Full URL: `http://localhost:3000/conversations/direct/{userId}`  
Controller: `ConversationsController`

### Mô tả
API tạo hoặc lấy direct conversation với một user khác. Nếu conversation đã tồn tại thì status là `200`, nếu mới tạo thì status là `201`.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | uuid | Yes | Target user ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200` hoặc `201`

```json
{
  "conversation": {
    "id": "55555555-5555-4555-8555-555555555555",
    "type": "direct",
    "members": [
      {
        "user": {
          "id": "11111111-1111-4111-8111-111111111111",
          "username": "alice_01",
          "displayName": "Alice",
          "avatarUrl": null
        },
        "joinedAt": "2026-05-16T12:00:00.000Z",
        "lastSeenMessageId": null,
        "lastSeenAt": null
      },
      {
        "user": {
          "id": "22222222-2222-4222-8222-222222222222",
          "username": "bob",
          "displayName": "Bob",
          "avatarUrl": "https://cdn.example.com/avatar.jpg"
        },
        "joinedAt": "2026-05-16T12:00:00.000Z",
        "lastSeenMessageId": null,
        "lastSeenAt": null
      }
    ],
    "lastMessage": null,
    "unreadCount": 0,
    "createdAt": "2026-05-16T12:00:00.000Z",
    "updatedAt": "2026-05-16T12:00:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `CHAT_CANNOT_MESSAGE_SELF` | Tạo chat với chính mình |
| 404 | `USER_NOT_FOUND` | Target user không tồn tại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/conversations/direct/22222222-2222-4222-8222-222222222222 \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "55555555-5555-4555-8555-555555555555",
      "type": "direct",
      "members": [
        {
          "user": {
            "id": "11111111-1111-4111-8111-111111111111",
            "username": "alice_01",
            "displayName": "Alice",
            "avatarUrl": null
          },
          "joinedAt": "2026-05-16T12:00:00.000Z",
          "lastSeenMessageId": null,
          "lastSeenAt": null
        },
        {
          "user": {
            "id": "22222222-2222-4222-8222-222222222222",
            "username": "bob",
            "displayName": "Bob",
            "avatarUrl": "https://cdn.example.com/avatar.jpg"
          },
          "joinedAt": "2026-05-16T12:00:00.000Z",
          "lastSeenMessageId": null,
          "lastSeenAt": null
        }
      ],
      "lastMessage": null,
      "unreadCount": 0,
      "createdAt": "2026-05-16T12:00:00.000Z",
      "updatedAt": "2026-05-16T12:00:00.000Z"
    }
  }
}
```

## [GET] /conversations

Full URL: `http://localhost:3000/conversations`  
Controller: `ConversationsController`

### Mô tả
API lấy danh sách conversation của user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `cursor` | uuid | No | Cursor phân trang |
| `limit` | number | No | 1-50, mặc định `20` |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "type": "direct",
      "members": [
        {
          "user": {
            "id": "22222222-2222-4222-8222-222222222222",
            "username": "bob",
            "displayName": "Bob",
            "avatarUrl": "https://cdn.example.com/avatar.jpg"
          },
          "joinedAt": "2026-05-16T12:00:00.000Z",
          "lastSeenMessageId": "66666666-6666-4666-8666-666666666666",
          "lastSeenAt": "2026-05-16T12:30:00.000Z"
        }
      ],
      "lastMessage": {
        "id": "66666666-6666-4666-8666-666666666666",
        "conversationId": "55555555-5555-4555-8555-555555555555",
        "sender": {
          "id": "22222222-2222-4222-8222-222222222222",
          "username": "bob",
          "displayName": "Bob",
          "avatarUrl": "https://cdn.example.com/avatar.jpg"
        },
        "type": "text",
        "content": "Hello Alice",
        "text": "Hello Alice",
        "mediaUrl": null,
        "deletedAt": null,
        "createdAt": "2026-05-16T12:30:00.000Z",
        "updatedAt": "2026-05-16T12:30:00.000Z"
      },
      "unreadCount": 1,
      "createdAt": "2026-05-16T12:00:00.000Z",
      "updatedAt": "2026-05-16T12:30:00.000Z"
    }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai `cursor` hoặc `limit` |

### Ví dụ request
```bash
curl "http://localhost:3000/conversations?limit=20" \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "type": "direct",
        "members": [
          {
            "user": {
              "id": "22222222-2222-4222-8222-222222222222",
              "username": "bob",
              "displayName": "Bob",
              "avatarUrl": "https://cdn.example.com/avatar.jpg"
            },
            "joinedAt": "2026-05-16T12:00:00.000Z",
            "lastSeenMessageId": "66666666-6666-4666-8666-666666666666",
            "lastSeenAt": "2026-05-16T12:30:00.000Z"
          }
        ],
        "lastMessage": {
          "id": "66666666-6666-4666-8666-666666666666",
          "conversationId": "55555555-5555-4555-8555-555555555555",
          "sender": {
            "id": "22222222-2222-4222-8222-222222222222",
            "username": "bob",
            "displayName": "Bob",
            "avatarUrl": "https://cdn.example.com/avatar.jpg"
          },
          "type": "text",
          "content": "Hello Alice",
          "text": "Hello Alice",
          "mediaUrl": null,
          "deletedAt": null,
          "createdAt": "2026-05-16T12:30:00.000Z",
          "updatedAt": "2026-05-16T12:30:00.000Z"
        },
        "unreadCount": 1,
        "createdAt": "2026-05-16T12:00:00.000Z",
        "updatedAt": "2026-05-16T12:30:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## [GET] /conversations/:id/messages

Full URL: `http://localhost:3000/conversations/{id}/messages`  
Controller: `ConversationsController`

### Mô tả
API lấy lịch sử tin nhắn của một conversation.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Conversation ID |

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `cursor` | uuid | No | Cursor phân trang |
| `limit` | number | No | 1-100, mặc định `30` |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "conversationId": "55555555-5555-4555-8555-555555555555",
      "sender": {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "type": "text",
      "content": "Hello Alice",
      "text": "Hello Alice",
      "mediaUrl": null,
      "deletedAt": null,
      "createdAt": "2026-05-16T12:30:00.000Z",
      "updatedAt": "2026-05-16T12:30:00.000Z"
    }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai `id`, `cursor`, `limit` |
| 403 | `CHAT_FORBIDDEN` | User không thuộc conversation |
| 404 | `CHAT_CONVERSATION_NOT_FOUND` | Conversation không tồn tại |

### Ví dụ request
```bash
curl "http://localhost:3000/conversations/55555555-5555-4555-8555-555555555555/messages?limit=30" \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "66666666-6666-4666-8666-666666666666",
        "conversationId": "55555555-5555-4555-8555-555555555555",
        "sender": {
          "id": "22222222-2222-4222-8222-222222222222",
          "username": "bob",
          "displayName": "Bob",
          "avatarUrl": "https://cdn.example.com/avatar.jpg"
        },
        "type": "text",
        "content": "Hello Alice",
        "text": "Hello Alice",
        "mediaUrl": null,
        "deletedAt": null,
        "createdAt": "2026-05-16T12:30:00.000Z",
        "updatedAt": "2026-05-16T12:30:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## [POST] /conversations/:id/messages

Full URL: `http://localhost:3000/conversations/{id}/messages`  
Controller: `ConversationsController`

### Mô tả
API gửi message text qua REST.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Conversation ID |

### Request Query
Không có.

### Request Body
```json
{
  "clientMessageId": "flutter-msg-001",
  "clientTempId": "temp-001",
  "text": "Hello from Flutter"
}
```

### Response thành công
HTTP `201`

```json
{
  "clientTempId": "temp-001",
  "clientMessageId": "flutter-msg-001",
  "message": {
    "id": "66666666-6666-4666-8666-666666666666",
    "conversationId": "55555555-5555-4555-8555-555555555555",
    "sender": {
      "id": "11111111-1111-4111-8111-111111111111",
      "username": "alice_01",
      "displayName": "Alice",
      "avatarUrl": null
    },
    "type": "text",
    "content": "Hello from Flutter",
    "text": "Hello from Flutter",
    "mediaUrl": null,
    "deletedAt": null,
    "createdAt": "2026-05-16T12:35:00.000Z",
    "updatedAt": "2026-05-16T12:35:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | `text/content` rỗng hoặc dài quá 2000 ký tự |
| 403 | `CHAT_FORBIDDEN` | User không thuộc conversation |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/conversations/55555555-5555-4555-8555-555555555555/messages \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"clientMessageId\":\"flutter-msg-001\",\"clientTempId\":\"temp-001\",\"text\":\"Hello from Flutter\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "clientTempId": "temp-001",
    "clientMessageId": "flutter-msg-001",
    "message": {
      "id": "66666666-6666-4666-8666-666666666666",
      "conversationId": "55555555-5555-4555-8555-555555555555",
      "sender": {
        "id": "11111111-1111-4111-8111-111111111111",
        "username": "alice_01",
        "displayName": "Alice",
        "avatarUrl": null
      },
      "type": "text",
      "content": "Hello from Flutter",
      "text": "Hello from Flutter",
      "mediaUrl": null,
      "deletedAt": null,
      "createdAt": "2026-05-16T12:35:00.000Z",
      "updatedAt": "2026-05-16T12:35:00.000Z"
    }
  }
}
```

## [POST] /conversations/:id/seen

Full URL: `http://localhost:3000/conversations/{id}/seen`  
Controller: `ConversationsController`

### Mô tả
API đánh dấu một message trong conversation là đã xem.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Conversation ID |

### Request Query
Không có.

### Request Body
```json
{
  "messageId": "66666666-6666-4666-8666-666666666666"
}
```

### Response thành công
HTTP `200`

```json
{
  "conversationId": "55555555-5555-4555-8555-555555555555",
  "userId": "11111111-1111-4111-8111-111111111111",
  "messageId": "66666666-6666-4666-8666-666666666666",
  "seenAt": "2026-05-16T12:35:00.000Z",
  "skipped": false
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai format ID |
| 400 | `CHAT_MESSAGE_NOT_IN_CONVERSATION` | Message không thuộc conversation này |
| 403 | `CHAT_FORBIDDEN` | User không thuộc conversation |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/conversations/55555555-5555-4555-8555-555555555555/seen \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"messageId\":\"66666666-6666-4666-8666-666666666666\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "conversationId": "55555555-5555-4555-8555-555555555555",
    "userId": "11111111-1111-4111-8111-111111111111",
    "messageId": "66666666-6666-4666-8666-666666666666",
    "seenAt": "2026-05-16T12:35:00.000Z",
    "skipped": false
  }
}
```

## [DELETE] /conversations/:id/messages/:messageId

Full URL: `http://localhost:3000/conversations/{id}/messages/{messageId}`  
Controller: `ConversationsController`

### Mô tả
API soft delete một message do chính user hiện tại gửi.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Conversation ID |
| `messageId` | uuid | Yes | Message ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "deleted": true,
  "id": "66666666-6666-4666-8666-666666666666",
  "conversationId": "55555555-5555-4555-8555-555555555555",
  "deletedAt": "2026-05-16T12:40:00.000Z"
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 403 | `CHAT_FORBIDDEN` | User không thuộc conversation |
| 403 | `CHAT_MESSAGE_FORBIDDEN` | Không phải sender của message |
| 404 | `CHAT_CONVERSATION_NOT_FOUND` | Conversation không tồn tại |
| 404 | `CHAT_MESSAGE_NOT_FOUND` | Message không tồn tại |

### Ví dụ request
```bash
curl -X DELETE http://localhost:3000/conversations/55555555-5555-4555-8555-555555555555/messages/66666666-6666-4666-8666-666666666666 \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "66666666-6666-4666-8666-666666666666",
    "conversationId": "55555555-5555-4555-8555-555555555555",
    "deletedAt": "2026-05-16T12:40:00.000Z"
  }
}
```

## [POST] /devices/token

Full URL: `http://localhost:3000/devices/token`  
Controller: `DevicesController`

### Mô tả
API manual upsert FCM token cho mục đích demo/test backend. Không cần auth.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "token": "fcm_token_value",
  "platform": "android",
  "userId": "11111111-1111-4111-8111-111111111111"
}
```

### Response thành công
HTTP `200`

```json
{
  "deviceToken": {
    "id": "88888888-8888-4888-8888-888888888888",
    "platform": "android",
    "deviceId": null,
    "appVersion": null,
    "lastUsedAt": "2026-05-16T13:00:00.000Z",
    "revokedAt": null,
    "createdAt": "2026-05-16T13:00:00.000Z",
    "updatedAt": "2026-05-16T13:00:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu token, sai `platform`, sai `userId` |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/devices/token \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"fcm_token_value\",\"platform\":\"android\",\"userId\":\"11111111-1111-4111-8111-111111111111\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "deviceToken": {
      "id": "88888888-8888-4888-8888-888888888888",
      "platform": "android",
      "deviceId": null,
      "appVersion": null,
      "lastUsedAt": "2026-05-16T13:00:00.000Z",
      "revokedAt": null,
      "createdAt": "2026-05-16T13:00:00.000Z",
      "updatedAt": "2026-05-16T13:00:00.000Z"
    }
  }
}
```

## [POST] /devices/fcm-token

Full URL: `http://localhost:3000/devices/fcm-token`  
Controller: `DevicesController`

### Mô tả
API đăng ký hoặc cập nhật FCM token cho user đang đăng nhập.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "token": "fcm_token_value",
  "platform": "android",
  "deviceId": "pixel-7",
  "appVersion": "1.0.0"
}
```

### Response thành công
HTTP `200`

```json
{
  "deviceToken": {
    "id": "88888888-8888-4888-8888-888888888888",
    "platform": "android",
    "deviceId": "pixel-7",
    "appVersion": "1.0.0",
    "lastUsedAt": "2026-05-16T13:05:00.000Z",
    "revokedAt": null,
    "createdAt": "2026-05-16T13:05:00.000Z",
    "updatedAt": "2026-05-16T13:05:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai `platform`, thiếu `token`, field quá dài |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/devices/fcm-token \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"fcm_token_value\",\"platform\":\"android\",\"deviceId\":\"pixel-7\",\"appVersion\":\"1.0.0\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "deviceToken": {
      "id": "88888888-8888-4888-8888-888888888888",
      "platform": "android",
      "deviceId": "pixel-7",
      "appVersion": "1.0.0",
      "lastUsedAt": "2026-05-16T13:05:00.000Z",
      "revokedAt": null,
      "createdAt": "2026-05-16T13:05:00.000Z",
      "updatedAt": "2026-05-16T13:05:00.000Z"
    }
  }
}
```

## [DELETE] /devices/fcm-token

Full URL: `http://localhost:3000/devices/fcm-token`  
Controller: `DevicesController`

### Mô tả
API revoke FCM token hiện tại của user.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "token": "fcm_token_value"
}
```

### Response thành công
HTTP `200`

```json
{
  "revoked": true
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Thiếu hoặc sai `token` |

### Ví dụ request
```bash
curl -X DELETE http://localhost:3000/devices/fcm-token \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"fcm_token_value\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "revoked": true
  }
}
```

## [GET] /devices/fcm-tokens

Full URL: `http://localhost:3000/devices/fcm-tokens`  
Controller: `DevicesController`

### Mô tả
API lấy danh sách FCM token còn active của user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "88888888-8888-4888-8888-888888888888",
      "platform": "android",
      "deviceId": "pixel-7",
      "appVersion": "1.0.0",
      "lastUsedAt": "2026-05-16T13:05:00.000Z",
      "revokedAt": null,
      "createdAt": "2026-05-16T13:05:00.000Z",
      "updatedAt": "2026-05-16T13:05:00.000Z"
    }
  ]
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |

### Ví dụ request
```bash
curl http://localhost:3000/devices/fcm-tokens \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "88888888-8888-4888-8888-888888888888",
        "platform": "android",
        "deviceId": "pixel-7",
        "appVersion": "1.0.0",
        "lastUsedAt": "2026-05-16T13:05:00.000Z",
        "revokedAt": null,
        "createdAt": "2026-05-16T13:05:00.000Z",
        "updatedAt": "2026-05-16T13:05:00.000Z"
      }
    ]
  }
}
```

## [POST] /notifications/test

Full URL: `http://localhost:3000/notifications/test`  
Controller: `NotificationsController`

### Mô tả
API gửi thử một push notification đến đúng một FCM token. Đây là endpoint test nội bộ.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "token": "fcm_token_value",
  "title": "Hello",
  "body": "Push test message",
  "data": {
    "screen": "inbox"
  }
}
```

### Response thành công
HTTP `200`

```json
{
  "sent": true
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu token/title/body hoặc data sai format |
| 400 | `FCM_TOKEN_INVALID` | Token FCM không hợp lệ |
| 400 | `FCM_SENDER_ID_MISMATCH` | Token không cùng Firebase project |
| 400 | `FCM_PERMISSION_DENIED` | Firebase credentials sai hoặc thiếu quyền |
| 500 | `FCM_SEND_FAILED` | Gửi push thất bại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/notifications/test \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"fcm_token_value\",\"title\":\"Hello\",\"body\":\"Push test message\",\"data\":{\"screen\":\"inbox\"}}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "sent": true
  }
}
```

## [POST] /notifications/test/user/:userId

Full URL: `http://localhost:3000/notifications/test/user/{userId}`  
Controller: `NotificationsController`

### Mô tả
API gửi push test tới tất cả FCM token active của một user. Đây là endpoint test nội bộ.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | uuid | Yes | User ID |

### Request Query
Không có.

### Request Body
```json
{
  "title": "Hello",
  "body": "Broadcast push test",
  "data": {
    "screen": "notifications"
  }
}
```

### Response thành công
HTTP `200`

```json
{
  "requestedCount": 2,
  "successCount": 2,
  "failureCount": 0,
  "invalidTokens": []
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Sai `userId` hoặc body không hợp lệ |
| 500 | `FCM_SEND_FAILED` | Firebase gửi hàng loạt thất bại |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/notifications/test/user/11111111-1111-4111-8111-111111111111 \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Hello\",\"body\":\"Broadcast push test\",\"data\":{\"screen\":\"notifications\"}}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "requestedCount": 2,
    "successCount": 2,
    "failureCount": 0,
    "invalidTokens": []
  }
}
```

## [GET] /notifications/unread-count

Full URL: `http://localhost:3000/notifications/unread-count`  
Controller: `NotificationsController`

### Mô tả
API lấy số lượng thông báo chưa đọc của user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "unreadCount": 5
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |

### Ví dụ request
```bash
curl http://localhost:3000/notifications/unread-count \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

## [GET] /notifications

Full URL: `http://localhost:3000/notifications`  
Controller: `NotificationsController`

### Mô tả
API lấy danh sách notification của user hiện tại.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
| Field | Type | Required | Description |
|---|---|---|---|
| `cursor` | uuid | No | Cursor phân trang |
| `limit` | number | No | 1-50, mặc định `20` |
| `unreadOnly` | boolean | No | Chỉ lấy notification chưa đọc |

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "items": [
    {
      "id": "77777777-7777-4777-8777-777777777777",
      "type": "LIKE",
      "recipientId": "11111111-1111-4111-8111-111111111111",
      "actor": {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "target": {
        "type": "POST",
        "id": "33333333-3333-4333-8333-333333333333"
      },
      "message": "Bob liked your post.",
      "metadata": null,
      "readAt": null,
      "createdAt": "2026-05-16T13:20:00.000Z",
      "updatedAt": "2026-05-16T13:20:00.000Z"
    }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai `cursor`, `limit`, `unreadOnly` |

### Ví dụ request
```bash
curl "http://localhost:3000/notifications?limit=20&unreadOnly=true" \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "77777777-7777-4777-8777-777777777777",
        "type": "LIKE",
        "recipientId": "11111111-1111-4111-8111-111111111111",
        "actor": {
          "id": "22222222-2222-4222-8222-222222222222",
          "username": "bob",
          "displayName": "Bob",
          "avatarUrl": "https://cdn.example.com/avatar.jpg"
        },
        "target": {
          "type": "POST",
          "id": "33333333-3333-4333-8333-333333333333"
        },
        "message": "Bob liked your post.",
        "metadata": null,
        "readAt": null,
        "createdAt": "2026-05-16T13:20:00.000Z",
        "updatedAt": "2026-05-16T13:20:00.000Z"
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

## [PATCH] /notifications/:id/read

Full URL: `http://localhost:3000/notifications/{id}/read`  
Controller: `NotificationsController`

### Mô tả
API đánh dấu một notification là đã đọc.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | Yes | Notification ID |

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "notification": {
    "id": "77777777-7777-4777-8777-777777777777",
    "type": "LIKE",
    "recipientId": "11111111-1111-4111-8111-111111111111",
    "actor": {
      "id": "22222222-2222-4222-8222-222222222222",
      "username": "bob",
      "displayName": "Bob",
      "avatarUrl": "https://cdn.example.com/avatar.jpg"
    },
    "target": {
      "type": "POST",
      "id": "33333333-3333-4333-8333-333333333333"
    },
    "message": "Bob liked your post.",
    "metadata": null,
    "readAt": "2026-05-16T13:25:00.000Z",
    "createdAt": "2026-05-16T13:20:00.000Z",
    "updatedAt": "2026-05-16T13:25:00.000Z"
  }
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai format `id` |
| 404 | `NOTIFICATION_NOT_FOUND` | Notification không thuộc user hoặc không tồn tại |

### Ví dụ request
```bash
curl -X PATCH http://localhost:3000/notifications/77777777-7777-4777-8777-777777777777/read \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "notification": {
      "id": "77777777-7777-4777-8777-777777777777",
      "type": "LIKE",
      "recipientId": "11111111-1111-4111-8111-111111111111",
      "actor": {
        "id": "22222222-2222-4222-8222-222222222222",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "target": {
        "type": "POST",
        "id": "33333333-3333-4333-8333-333333333333"
      },
      "message": "Bob liked your post.",
      "metadata": null,
      "readAt": "2026-05-16T13:25:00.000Z",
      "createdAt": "2026-05-16T13:20:00.000Z",
      "updatedAt": "2026-05-16T13:25:00.000Z"
    }
  }
}
```

## [PATCH] /notifications/read-all

Full URL: `http://localhost:3000/notifications/read-all`  
Controller: `NotificationsController`

### Mô tả
API đánh dấu toàn bộ notification chưa đọc của user hiện tại là đã đọc.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`

```json
{
  "updatedCount": 5
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |

### Ví dụ request
```bash
curl -X PATCH http://localhost:3000/notifications/read-all \
  -H "Authorization: Bearer jwt_access_token"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "updatedCount": 5
  }
}
```

## [POST] /uploads/image

Full URL: `http://localhost:3000/uploads/image`  
Controller: `UploadsController`

### Mô tả
API upload ảnh cho post, reply hoặc avatar profile. Dùng `multipart/form-data`.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
`multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | JPEG/PNG/WebP, tối đa 5MB |
| `type` | string | Yes | `post`, `reply`, `profile_avatar` |

### Response thành công
HTTP `201`

```json
{
  "url": "https://cdn.example.com/uploads/image.jpg",
  "publicId": "threads-like/post/abc123"
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `VALIDATION_ERROR` | Sai `type` |
| 400 | `UPLOAD_FILE_REQUIRED` | Không gửi file |
| 400 | `UPLOAD_INVALID_MIME_TYPE` | Sai MIME type |
| 413 | `UPLOAD_FILE_TOO_LARGE` | File lớn hơn giới hạn |
| 502 | `UPLOAD_PROVIDER_FAILED` | Provider upload lỗi |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/uploads/image \
  -H "Authorization: Bearer jwt_access_token" \
  -F "type=post" \
  -F "file=@C:/tmp/image.jpg"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "url": "https://cdn.example.com/uploads/image.jpg",
    "publicId": "threads-like/post/abc123"
  }
}
```

## [POST] /uploads/video

Full URL: `http://localhost:3000/uploads/video`  
Controller: `UploadsController`

### Mô tả
API upload video cho post. Dùng `multipart/form-data`.

### Authentication
Required: Yes  
Bearer Token: Yes  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
`multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | MP4/MOV/WEBM, tối đa 100MB |

### Response thành công
HTTP `201`

```json
{
  "url": "https://cdn.example.com/uploads/video.mp4",
  "publicId": "threads-like/post/video123",
  "durationSeconds": 8
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Thiếu Bearer token |
| 400 | `UPLOAD_FILE_REQUIRED` | Không gửi file |
| 400 | `UPLOAD_INVALID_MIME_TYPE` | Sai MIME type |
| 413 | `UPLOAD_FILE_TOO_LARGE` | File quá lớn |
| 502 | `UPLOAD_PROVIDER_FAILED` | Provider upload lỗi |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/uploads/video \
  -H "Authorization: Bearer jwt_access_token" \
  -F "file=@C:/tmp/video.mp4"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "url": "https://cdn.example.com/uploads/video.mp4",
    "publicId": "threads-like/post/video123",
    "durationSeconds": 8
  }
}
```

## [POST] /moderation/check

Full URL: `http://localhost:3000/moderation/check`  
Controller: `ModerationController`

### Mô tả
API kiểm tra moderation cho một đoạn text qua AI moderation service.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
```json
{
  "text": "Some text to moderate"
}
```

### Response thành công
HTTP `200`

```json
{
  "label": "SAFE",
  "toxicityScore": 0.01,
  "categories": [],
  "message": "",
  "highlights": [],
  "suggestion": "",
  "model": "model-v1"
}
```

### Response lỗi thường gặp
| HTTP | Code | Khi nào xảy ra |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `text` rỗng hoặc dài quá 5000 ký tự |

### Ví dụ request
```bash
curl -X POST http://localhost:3000/moderation/check \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Some text to moderate\"}"
```

### Ví dụ response
```json
{
  "success": true,
  "data": {
    "label": "SAFE",
    "toxicityScore": 0.01,
    "categories": [],
    "message": "",
    "highlights": [],
    "suggestion": "",
    "model": "model-v1"
  }
}
```

## [GET] /demo

Full URL: `http://localhost:3000/demo`  
Controller: `DemoController`

### Mô tả
API trả về file HTML demo trong `public/demo/index.html`. Đây là endpoint phục vụ demo web, không phải JSON API cho Flutter.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`, content-type `text/html`

### Response lỗi thường gặp
Có thể lỗi file not found nếu asset demo bị thiếu.

### Ví dụ request
```bash
curl http://localhost:3000/demo
```

### Ví dụ response
Trả về HTML page.

## [GET] /demo/fcm

Full URL: `http://localhost:3000/demo/fcm`  
Controller: `DemoController`

### Mô tả
API trả về file HTML demo FCM trong `public/demo/fcm.html`. Đây là endpoint demo web, không dùng cho Flutter app runtime.

### Authentication
Required: No  
Bearer Token: No  
Roles: None

### Request Params
Không có.

### Request Query
Không có.

### Request Body
Không có.

### Response thành công
HTTP `200`, content-type `text/html`

### Response lỗi thường gặp
Có thể lỗi file not found nếu asset demo bị thiếu.

### Ví dụ request
```bash
curl http://localhost:3000/demo/fcm
```

### Ví dụ response
Trả về HTML page.

## Ghi chú cho Flutter team

- `accessToken` dùng cho Bearer auth, `refreshToken` chỉ dùng ở API refresh/logout
- Các endpoint list đều đang dùng cursor pagination, không dùng page number
- Với endpoint có optional auth như profile/replies/followers, gửi Bearer token sẽ giúp backend tính `isFollowing` hoặc `isLikedByMe` chính xác hơn
- Upload media đi trước qua `/uploads/image` hoặc `/uploads/video`, lấy `url` trả về rồi gắn vào `mediaUrls` khi tạo post/reply hoặc `avatarUrl` khi update profile
- `notifications.type` hiện tại có thể là `LIKE`, `REPLY`, `FOLLOW`, `MESSAGE`, `SYSTEM`
- `conversation.type` và `message.type` trong response được trả về lowercase như `direct`, `text`
