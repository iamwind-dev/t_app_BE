# BE Run And Test Guide

Tai thoi diem kiem tra, cac muc trong `task.md` da duoc hoan thanh ve code va da pass build/test:

- `npm.cmd run prisma:validate`
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`

## 1. Chay Backend

### 1.1 Cai dependency

```cmd
npm.cmd install
```

### 1.2 Tao `.env`

Neu chua co `.env`, copy tu `.env.example`:

```cmd
copy .env.example .env
```

Toi thieu can cac bien nay:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/threads_like?schema=public
JWT_ACCESS_SECRET=replace-with-a-strong-secret
JWT_ACCESS_EXPIRES_IN=1h
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
SWAGGER_ENABLED=true
SWAGGER_PATH=docs
UPLOAD_STORAGE_PROVIDER=local
UPLOAD_LOCAL_DIR=uploads
UPLOAD_PUBLIC_BASE_URL=http://localhost:3000/uploads
UPLOAD_MAX_IMAGE_SIZE_BYTES=5242880
```

Neu test Firebase push that, them mot trong hai cach:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"projectId":"...","clientEmail":"...","privateKey":"..."}
```

Hoac:

```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Khong cau hinh Firebase thi BE van chay; push provider se no-op.

### 1.3 Prisma

```cmd
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:dev
```

### 1.4 Start BE

```cmd
npm.cmd run start:dev
```

Server mac dinh:

```text
http://localhost:3000
```

Health check:

```cmd
curl -i http://localhost:3000/health
```

Swagger:

```text
http://localhost:3000/docs
```

## 2. Test Tu Dong

Chay tat ca unit tests:

```cmd
npm.cmd test -- --runInBand
```

Chay tat ca e2e tests:

```cmd
npm.cmd run test:e2e -- --runInBand
```

Build:

```cmd
npm.cmd run build
```

## 3. Chuan Bi Bien CMD De Test Curl

Mo CMD moi, set base URL:

```cmd
set BASE=http://localhost:3000
```

Tao/login user A:

```cmd
curl -s -X POST %BASE%/auth/register -H "Content-Type: application/json" -d "{\"email\":\"demo@example.com\",\"username\":\"demo_user\",\"password\":\"Duong123456\",\"displayName\":\"Demo User\"}"
curl -s -X POST %BASE%/auth/login -H "Content-Type: application/json" -d "{\"identifier\":\"demo@example.com\",\"password\":\"Duong123456\"}"
```

Copy `accessToken`, `refreshToken`, `user.id` tu response va set:

```cmd
set A_TOKEN=PASTE_ACCESS_TOKEN_A
set A_REFRESH=PASTE_REFRESH_TOKEN_A
set A_ID=PASTE_USER_ID_A
```

Tao/login user B:

```cmd
curl -s -X POST %BASE%/auth/register -H "Content-Type: application/json" -d "{\"email\":\"demo1@example.com\",\"username\":\"demo_user1\",\"password\":\"Duong123456\",\"displayName\":\"Demo User 1\"}"
curl -s -X POST %BASE%/auth/login -H "Content-Type: application/json" -d "{\"identifier\":\"demo1@example.com\",\"password\":\"Duong123456\"}"
```

Copy token/id cua B:

```cmd
set B_TOKEN=PASTE_ACCESS_TOKEN_B
set B_REFRESH=PASTE_REFRESH_TOKEN_B
set B_ID=PASTE_USER_ID_B
```

Neu user da ton tai thi bo qua register va chi login.

## 4. Auth

### Register

```cmd
curl -i -X POST %BASE%/auth/register -H "Content-Type: application/json" -d "{\"email\":\"new@example.com\",\"username\":\"new_user\",\"password\":\"Duong123456\",\"displayName\":\"New User\"}"
```

Ky vong: `201`, co `user`, `accessToken`, `refreshToken`.

### Login

```cmd
curl -i -X POST %BASE%/auth/login -H "Content-Type: application/json" -d "{\"identifier\":\"demo@example.com\",\"password\":\"Duong123456\"}"
```

Ky vong: `200`, co `accessToken`, `refreshToken`.

### Me

```cmd
curl -i %BASE%/auth/me -H "Authorization: Bearer %A_TOKEN%"
```

Ky vong: `200`, tra user hien tai, khong co `passwordHash`.

### Refresh Token

```cmd
curl -i -X POST %BASE%/auth/refresh -H "Content-Type: application/json" -d "{\"refreshToken\":\"%A_REFRESH%\"}"
```

Ky vong: `200`, tra `accessToken` moi va `refreshToken` moi. Refresh token cu se bi revoke.

### Logout

```cmd
curl -i -X POST %BASE%/auth/logout -H "Content-Type: application/json" -d "{\"refreshToken\":\"%A_REFRESH%\"}"
```

Ky vong: `200`, `{ "loggedOut": true }`.

### Change Password

```cmd
curl -i -X POST %BASE%/auth/change-password -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"currentPassword\":\"Duong123456\",\"newPassword\":\"Duong1234567\"}"
```

Ky vong: `200`, `{ "changed": true }`, cac refresh token dang active cua user bi revoke.

## 5. Users/Profile

### Get Profile By ID

```cmd
curl -i %BASE%/users/%A_ID% -H "Authorization: Bearer %A_TOKEN%"
```

Ky vong: `200`, co `followersCount`, `followingCount`, `postCount`, `isFollowing`.

### Get Profile By Username

```cmd
curl -i %BASE%/users/username/demo_user -H "Authorization: Bearer %A_TOKEN%"
```

### Update Me

```cmd
curl -i -X PATCH %BASE%/users/me -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"displayName\":\"Demo User Updated\",\"bio\":\"hello bio\"}"
```

## 6. Uploads

### Upload Image Local

Doi duong dan file anh cho dung may cua ban:

```cmd
curl -i -X POST %BASE%/uploads/image -H "Authorization: Bearer %A_TOKEN%" -F "type=post" -F "file=@C:\Users\hiep1\OneDrive\Desktop\test.jpg"
```

Ky vong: `201`, tra:

```json
{
  "upload": {
    "id": "...",
    "secureUrl": "http://localhost:3000/uploads/...",
    "publicId": "...",
    "type": "post"
  }
}
```

Copy `secureUrl` neu muon test attach vao post/reply/avatar:

```cmd
set MEDIA_URL=PASTE_SECURE_URL
```

## 7. Posts

### Create Post

```cmd
curl -i -X POST %BASE%/posts -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"content\":\"hello post\"}"
```

Copy `post.id`:

```cmd
set POST_ID=PASTE_POST_ID
```

### Create Post With Media

```cmd
curl -i -X POST %BASE%/posts -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"content\":\"post with media\",\"mediaUrls\":[\"%MEDIA_URL%\"]}"
```

Ky vong: upload metadata duoc attach vao post.

### Feed

```cmd
curl -i "%BASE%/posts/feed?limit=20" -H "Authorization: Bearer %A_TOKEN%"
```

### Detail

```cmd
curl -i %BASE%/posts/%POST_ID% -H "Authorization: Bearer %A_TOKEN%"
```

### Update

```cmd
curl -i -X PATCH %BASE%/posts/%POST_ID% -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"content\":\"updated post\"}"
```

### Soft Delete

```cmd
curl -i -X DELETE %BASE%/posts/%POST_ID% -H "Authorization: Bearer %A_TOKEN%"
```

Ky vong: `{ "deleted": true }`, `postCount` cua user giam.

## 8. Replies

Can co `POST_ID` active.

### Create Top-level Reply

```cmd
curl -i -X POST %BASE%/posts/%POST_ID%/replies -H "Authorization: Bearer %B_TOKEN%" -H "Content-Type: application/json" -d "{\"content\":\"reply from B\"}"
```

Copy `reply.id`:

```cmd
set REPLY_ID=PASTE_REPLY_ID
```

### List Post Replies

```cmd
curl -i "%BASE%/posts/%POST_ID%/replies?limit=20" -H "Authorization: Bearer %A_TOKEN%"
```

### Get Reply Detail

```cmd
curl -i %BASE%/replies/%REPLY_ID% -H "Authorization: Bearer %A_TOKEN%"
```

### Update Reply

```cmd
curl -i -X PATCH %BASE%/replies/%REPLY_ID% -H "Authorization: Bearer %B_TOKEN%" -H "Content-Type: application/json" -d "{\"content\":\"updated reply\"}"
```

### Child Reply

```cmd
curl -i -X POST %BASE%/replies/%REPLY_ID%/replies -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"content\":\"child reply\"}"
```

### List Child Replies

```cmd
curl -i "%BASE%/replies/%REPLY_ID%/children?limit=20" -H "Authorization: Bearer %A_TOKEN%"
```

### Soft Delete Reply

```cmd
curl -i -X DELETE %BASE%/replies/%REPLY_ID% -H "Authorization: Bearer %B_TOKEN%"
```

Ky vong: `{ "deleted": true }`, `replyCount`/`childReplyCount` duoc cap nhat.

## 9. Reactions

Can co post/reply active.

### Like Post

```cmd
curl -i -X POST %BASE%/posts/%POST_ID%/like -H "Authorization: Bearer %B_TOKEN%"
```

Ky vong: `likeCount` tang len `1`, duplicate like khong tang tiep.

### Unlike Post

```cmd
curl -i -X DELETE %BASE%/posts/%POST_ID%/like -H "Authorization: Bearer %B_TOKEN%"
```

Ky vong: `likeCount` giam atomic, khong xuong am.

### Like Reply

```cmd
curl -i -X POST %BASE%/replies/%REPLY_ID%/like -H "Authorization: Bearer %A_TOKEN%"
```

### Unlike Reply

```cmd
curl -i -X DELETE %BASE%/replies/%REPLY_ID%/like -H "Authorization: Bearer %A_TOKEN%"
```

## 10. Follows

### Follow

```cmd
curl -i -X POST %BASE%/users/%B_ID%/follow -H "Authorization: Bearer %A_TOKEN%"
```

Ky vong: `isFollowing=true`, `followersCount` cua B tang, tao notification FOLLOW cho B.

### Followers

```cmd
curl -i "%BASE%/users/%B_ID%/followers?limit=20" -H "Authorization: Bearer %A_TOKEN%"
```

### Following

```cmd
curl -i "%BASE%/users/%A_ID%/following?limit=20" -H "Authorization: Bearer %A_TOKEN%"
```

### Unfollow

```cmd
curl -i -X DELETE %BASE%/users/%B_ID%/follow -H "Authorization: Bearer %A_TOKEN%"
```

Ky vong: `isFollowing=false`, counter giam.

## 11. Notifications

### Unread Count

```cmd
curl -i %BASE%/notifications/unread-count -H "Authorization: Bearer %B_TOKEN%"
```

### List Notifications

```cmd
curl -i "%BASE%/notifications?limit=20&unreadOnly=true" -H "Authorization: Bearer %B_TOKEN%"
```

Copy `notification.id`:

```cmd
set NOTIFICATION_ID=PASTE_NOTIFICATION_ID
```

### Mark One As Read

```cmd
curl -i -X PATCH %BASE%/notifications/%NOTIFICATION_ID%/read -H "Authorization: Bearer %B_TOKEN%"
```

### Mark All As Read

```cmd
curl -i -X PATCH %BASE%/notifications/read-all -H "Authorization: Bearer %B_TOKEN%"
```

Ky vong: `updatedCount` la so notification da chuyen tu unread sang read.

## 12. Conversations And Messages

### Create/Get Direct Conversation

```cmd
curl -i -X POST %BASE%/conversations/direct/%B_ID% -H "Authorization: Bearer %A_TOKEN%"
```

Copy `conversation.id`:

```cmd
set CONVERSATION_ID=PASTE_CONVERSATION_ID
```

### List Conversations

```cmd
curl -i "%BASE%/conversations?limit=20" -H "Authorization: Bearer %A_TOKEN%"
```

### Send Message

```cmd
curl -i -X POST %BASE%/conversations/%CONVERSATION_ID%/messages -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"text\":\"hello chat\"}"
```

Copy `message.id`:

```cmd
set MESSAGE_ID=PASTE_MESSAGE_ID
```

### Get Messages

```cmd
curl -i "%BASE%/conversations/%CONVERSATION_ID%/messages?limit=30" -H "Authorization: Bearer %A_TOKEN%"
```

### REST Mark Seen

```cmd
curl -i -X POST %BASE%/conversations/%CONVERSATION_ID%/seen -H "Authorization: Bearer %B_TOKEN%" -H "Content-Type: application/json" -d "{\"messageId\":\"%MESSAGE_ID%\"}"
```

### Message Soft Delete

```cmd
curl -i -X DELETE %BASE%/conversations/%CONVERSATION_ID%/messages/%MESSAGE_ID% -H "Authorization: Bearer %A_TOKEN%"
```

Ky vong: `{ "deleted": true }`, message history/preview/unread khong tinh message da xoa.

## 13. Device Tokens And Firebase Push

### Register FCM Token

```cmd
curl -i -X POST %BASE%/devices/fcm-token -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"token\":\"fake-fcm-token-a\",\"platform\":\"android\",\"deviceId\":\"pixel-8\",\"appVersion\":\"1.0.0\"}"
```

Ky vong: response khong tra raw token.

### List Active Tokens

```cmd
curl -i %BASE%/devices/fcm-tokens -H "Authorization: Bearer %A_TOKEN%"
```

### Revoke Token

```cmd
curl -i -X DELETE %BASE%/devices/fcm-token -H "Authorization: Bearer %A_TOKEN%" -H "Content-Type: application/json" -d "{\"token\":\"fake-fcm-token-a\"}"
```

Ky vong: `{ "revoked": true }`.

### Test Firebase Push That

1. Cau hinh Firebase env trong `.env`.
2. Flutter/mobile dang ky FCM token that bang `POST /devices/fcm-token`.
3. Tao event notification, vi du A follow B hoac A gui message cho B.
4. Device cua B nhan push tu Firebase.

Neu Firebase tra token invalid/not registered, backend se soft revoke token do.

## 14. Upload Association And Orphan Cleanup

Khong co public API cleanup rieng. Flow da duoc xu ly trong service:

- Upload anh tra `upload.id` va `secureUrl`.
- Khi tao/update post voi `mediaUrls`, upload metadata duoc attach vao post.
- Khi tao/update reply voi `mediaUrls`, upload metadata duoc attach vao reply.
- Khi update avatar, upload metadata duoc attach vao user avatar.
- Khi soft delete post/reply hoac remove avatar, upload metadata duoc danh dau `orphaned`.
- Pending uploads cu co service cleanup noi bo `markOldPendingUploadsOrphaned`.

Test bang cach upload anh, tao post voi `mediaUrls`, sau do delete post. Kiem tra DB bang Prisma/DB client neu can.

## 15. Demo Page

Neu demo web static duoc build san:

```cmd
curl -i %BASE%/demo
```

Hoac mo:

```text
http://localhost:3000/demo
```

## 16. Status Theo `task.md`

Da hoan thanh:

- Replies CRUD day du, ownership, soft delete, counters.
- Follow/social graph, followers/following pagination, follow notification, `FollowsModule`.
- Counter consistency cho posts/replies/reactions.
- Notifications unread count, list, mark read, mark all read, e2e.
- Chat mobile REST mark seen, preview/unread behavior, message soft delete.
- Device tokens register/revoke/list/update `lastUsedAt`.
- Upload metadata, ownership, association, orphan cleanup metadata.
- Auth v2: refresh token rotation, logout revoke, change password.
- Firebase push provider that.
- Unit/e2e coverage cho auth/posts/replies/follows/notifications va cac service chinh.

Khong thay task nao trong `task.md` con mo sau lan kiem tra nay.
