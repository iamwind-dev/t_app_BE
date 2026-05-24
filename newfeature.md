# New Features Handoff (Backend -> Flutter)

## 1) Cloudinary Image Upload

### Endpoint
- `POST /uploads/image`
- Auth: `Bearer JWT` (required)
- Content-Type: `multipart/form-data`

### Request Form Data
- `type`: `post` | `reply` | `profile_avatar`
- `file`: image file

### Validation
- MIME: `image/jpeg`, `image/png`, `image/webp`
- Max size: `UPLOAD_MAX_IMAGE_SIZE_BYTES` (default `5MB`)

### Success Response
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/.../image/upload/...",
    "publicId": "threads-like/posts/<userId>/<uuid>"
  }
}
```

### Notes for Flutter
- Use `data.url` for:
  - `posts.mediaUrls[]`
  - `replies.mediaUrls[]`
  - `users.avatarUrl`
- Keep `publicId` for future delete flow.

---

## 2) Post Video Upload (Max 10s)

### Endpoint
- `POST /uploads/video`
- Auth: `Bearer JWT` (required)
- Content-Type: `multipart/form-data`

### Request Form Data
- `file`: video file

### Validation
- MIME: `video/mp4`, `video/quicktime` (MOV), `video/webm`
- Max size: `UPLOAD_MAX_VIDEO_SIZE_BYTES` (default `100MB`)
- Duration: `<= 10s` (enforced server-side via Cloudinary metadata)

### Success Response
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/.../video/upload/...",
    "publicId": "threads-like/posts/<userId>/<uuid>",
    "durationSeconds": 8.2
  }
}
```

### Behavior when duration > 10s
- API returns `UPLOAD_VIDEO_DURATION_EXCEEDED`.
- Backend deletes uploaded asset from Cloudinary to avoid orphan files.

### Notes for Flutter
- Use `data.url` in `posts.mediaUrls[]`.
- Current endpoint scope is post video only.

---

## 3) Push Notification Demo (Backend First)

### Device token manual register
- `POST /devices/token`
- Auth: not required (demo endpoint)

Request:
```json
{
  "token": "FCM_WEB_TOKEN_DEMO",
  "platform": "web",
  "userId": "optional-uuid"
}
```

Behavior:
- Upsert by unique `token`.
- `userId` is optional for backend-first testing.

### Test push to one token
- `POST /notifications/test`
- Auth: not required (demo endpoint)

Request:
```json
{
  "token": "FCM_WEB_TOKEN_DEMO",
  "title": "Test notification",
  "body": "Hello from NestJS backend",
  "data": {
    "type": "SYSTEM",
    "screen": "demo"
  }
}
```

### Test push to all tokens of one user
- `POST /notifications/test/user/:userId`
- Auth: not required (demo endpoint)

Request:
```json
{
  "title": "Co thong bao moi",
  "body": "Ban co noi dung moi",
  "data": {
    "type": "NEW_POST",
    "postId": "demo-post-id"
  }
}
```

Response includes:
- `requestedCount`
- `successCount`
- `failureCount`
- `invalidTokens`

Behavior:
- Sends multicast to active tokens of user.
- Saves one `Notification` record with `type: SYSTEM`.
- Deletes invalid tokens from DB.

---

## 4) FCM Web Token Demo Page

- URL: `GET /demo/fcm`
- Purpose: generate FCM web token for manual backend testing.

Input fields:
- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `VAPID Key`

Flow:
- Request browser notification permission.
- Register service worker: `/firebase-messaging-sw.js`.
- Call Firebase `getToken(...)`.
- Copy token and use it in `/devices/token` or `/notifications/test`.

---

## 5) Error Codes to Handle

Upload:
- `UPLOAD_FILE_REQUIRED`
- `UPLOAD_INVALID_MIME_TYPE`
- `UPLOAD_FILE_TOO_LARGE`
- `UPLOAD_PROVIDER_NOT_CONFIGURED`
- `UPLOAD_VIDEO_DURATION_EXCEEDED`
- `UPLOAD_PROVIDER_FAILED`

Push:
- `PUSH_PROVIDER_NOT_CONFIGURED`
- `FCM_TOKEN_INVALID`
- `FCM_SENDER_ID_MISMATCH`
- `FCM_PERMISSION_DENIED`
- `FCM_SEND_FAILED`

---

## 6) Required Env (Backend)

Cloudinary:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER` (default: `threads-like`)
- `UPLOAD_MAX_IMAGE_SIZE_BYTES` (default: `5242880`)
- `UPLOAD_MAX_VIDEO_SIZE_BYTES` (default: `104857600`)

Firebase Admin:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Note:
- Keep `FIREBASE_PRIVATE_KEY` as one-line env value with escaped newlines `\\n`.

---

## 7) Flutter Multipart Examples

### Image
```dart
final req = http.MultipartRequest(
  'POST',
  Uri.parse('$baseUrl/uploads/image'),
)
  ..headers['Authorization'] = 'Bearer $token'
  ..fields['type'] = 'post'
  ..files.add(await http.MultipartFile.fromPath('file', imagePath));
```

### Video
```dart
final req = http.MultipartRequest(
  'POST',
  Uri.parse('$baseUrl/uploads/video'),
)
  ..headers['Authorization'] = 'Bearer $token'
  ..files.add(await http.MultipartFile.fromPath('file', videoPath));
```
