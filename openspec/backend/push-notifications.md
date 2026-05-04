# Push Notifications OpenSpec

## 1. Goal

The Push Notifications module provides Firebase Cloud Messaging delivery when a
user receives a new message in a conversation.

MVP scope:

- Flutter gets an FCM token after the user logs in successfully and sends it to the backend.
- Backend stores FCM tokens by user and device in a `DeviceToken` table.
- When `send_message` successfully persists a message to PostgreSQL, backend emits the Socket.IO `new_message` event as defined in the chat spec and sends an FCM notification to the recipient when the recipient is offline or in background.
- FCM payload for message notifications must contain `type = message`, `conversationId`, and `senderId`.
- When the user taps the notification, Flutter opens `ChatDetailPage` using `conversationId`.

Out of MVP scope:

- Do not add queues, workers, or notification providers other than Firebase Cloud Messaging.
- Do not send push notifications for likes, replies, follows, or system events in this spec.
- Do not replace Socket.IO realtime delivery. FCM only supplements offline/background states.
- Do not store sensitive message content in the FCM data payload.

## 2. Database Model

### 2.1 DeviceToken

`DeviceToken` stores the FCM registration token for each user and device.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | UUID | yes | Primary key |
| `userId` | UUID | yes | Relation to `User` |
| `token` | string | yes | Current FCM registration token for the device |
| `platform` | enum | yes | `ios`, `android`, or `web` if needed later |
| `deviceId` | string nullable | no | Stable device id from Flutter when available |
| `appVersion` | string nullable | no | App version for internal debug/analytics |
| `lastUsedAt` | DateTime | yes | Updated every time the token is upserted |
| `revokedAt` | DateTime nullable | no | Soft revoke token on logout or invalid token |
| `createdAt` | DateTime | yes | Set automatically on create |
| `updatedAt` | DateTime | yes | Set automatically on create/update |

Recommended constraints/indexes:

- `@@unique([token])`
- `@@index([userId, revokedAt])`
- `@@index([lastUsedAt])`
- If `deviceId` is stable, consider `@@unique([userId, deviceId])` for per-device upsert.

### 2.2 Suggested Prisma Shape

```prisma
enum DevicePlatform {
  ios
  android
  web
}

model DeviceToken {
  id         String         @id @default(uuid()) @db.Uuid
  userId     String         @db.Uuid
  user       User           @relation(fields: [userId], references: [id])
  token      String         @unique
  platform   DevicePlatform
  deviceId   String?
  appVersion String?
  lastUsedAt DateTime
  revokedAt  DateTime?
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@index([userId, revokedAt])
  @@index([lastUsedAt])
}
```

Enum names can be adjusted to existing Prisma conventions, but the client API
should use lowercase strings: `ios`, `android`, `web`.

## 3. APIs

All Devices/Push Notifications APIs are private and require JWT:

```http
Authorization: Bearer jwt.access.token
```

User id must come from the JWT payload, not from the request body.

### 3.1 POST /devices/fcm-token

Registers or updates the current device's FCM token for the authenticated user.

#### Authentication

Private API. JWT guard is required.

#### Request Body

```json
{
  "token": "fcm-registration-token",
  "platform": "android",
  "deviceId": "device-optional-stable-id",
  "appVersion": "1.0.0"
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `token` | string | yes | Trim, non-empty, maximum 4096 characters |
| `platform` | enum | yes | `ios`, `android`, or `web` |
| `deviceId` | string | no | Trim, maximum 255 characters |
| `appVersion` | string | no | Trim, maximum 50 characters |

#### Response 200

Returns 200 for both create and update to keep the API idempotent.

```json
{
  "success": true,
  "data": {
    "deviceToken": {
      "id": "6e78f9f5-1bb5-497f-96ec-4465c7fcd74a",
      "platform": "android",
      "deviceId": "device-optional-stable-id",
      "lastUsedAt": "2026-04-24T14:00:00.000Z",
      "createdAt": "2026-04-24T14:00:00.000Z",
      "updatedAt": "2026-04-24T14:00:00.000Z"
    }
  }
}
```

Response should not return the raw FCM token unless there is a clear debugging
reason.

### 3.2 DELETE /devices/fcm-token

Revokes the current device's FCM token. This is usually called on logout or when
Flutter receives a token refresh and needs to remove the old token.

#### Authentication

Private API. JWT guard is required.

#### Request Body

```json
{
  "token": "fcm-registration-token"
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `token` | string | yes | Trim, non-empty, maximum 4096 characters |

#### Response 200

```json
{
  "success": true,
  "data": {
    "revoked": true
  }
}
```

The API should be idempotent. If the token does not exist or is already revoked,
still return 200 with `revoked: false` or `revoked: true` according to the
service convention, as long as token ownership is not leaked.

## 4. Business Rules

- FCM tokens are assigned only to the authenticated user from JWT.
- Backend must not trust `userId` from request body when registering or deleting tokens.
- `POST /devices/fcm-token` must validate token, platform, deviceId, and appVersion with DTOs.
- `POST /devices/fcm-token` should upsert by `token` or by `[userId, deviceId]` when `deviceId` is stable.
- If the same FCM token is sent by another user, the service must transfer token ownership to the new user and revoke/disable the old link to avoid sending pushes to the wrong account after logout/login on the same device.
- `DELETE /devices/fcm-token` only revokes the current user's token. If the token belongs to another user, do not reveal ownership.
- Revoked tokens (`revokedAt != null`) must not be used for FCM sends.
- When Firebase reports a token as invalid, not registered, or expired, backend must mark that token revoked so it is not used again.
- Backend sends FCM only after the message has been persisted successfully in DB.
- Processing order for `send_message`: validate membership, save message, update conversation metadata, emit Socket.IO `new_message`, then send FCM to offline/background receiver.
- First-phase direct conversations have one receiver: the other member. If group conversations are added later, send FCM to all members except the sender.
- Do not send FCM to the sender.
- Do not send FCM if the receiver is online and active in the conversation room when the message is emitted.
- If foreground/background cannot be determined exactly, backend may use socket presence: no active socket or not joined to the conversation room means push may be needed.
- FCM send failures must not roll back a successfully saved message.
- FCM send failures must not fail the `send_message` ack when message persistence and Socket.IO emit succeeded. Log failures internally with minimal information.
- FCM data payload must be small, stable, and must not contain password hashes, auth tokens, private email, sensitive content, or internal metadata.
- Firebase Admin SDK credentials must come from secure environment/config. Do not commit service account JSON to the repository.
- Prisma access must go through the existing Prisma service.

## 5. FCM Payload

FCM message notifications must use a stable data payload so Flutter can route
when the user taps a notification.

### 5.1 Data Payload

```json
{
  "type": "message",
  "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
  "senderId": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1"
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `type` | string | yes | Always `message` for this spec |
| `conversationId` | string | yes | Conversation UUID for the message |
| `senderId` | string | yes | User UUID of the message sender |

### 5.2 Notification Display Payload

Backend may also send a `notification` payload so the OS can display title/body
when the app is backgrounded:

```json
{
  "notification": {
    "title": "New message",
    "body": "You have a new message."
  },
  "data": {
    "type": "message",
    "conversationId": "3a50afcb-17a4-4d7c-8f58-c3d280467ba1",
    "senderId": "7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1"
  }
}
```

Title/body can later be improved to show sender name when public profile data is
available. Do not put message content into the push payload in the MVP unless
there is a clear privacy decision.

## 6. Flutter Handling Flow

### 6.1 Token Registration Flow

- After login succeeds and Flutter has a JWT access token, Flutter requests notification permission according to iOS/Android requirements.
- Flutter gets the FCM registration token from Firebase Messaging.
- Flutter calls `POST /devices/fcm-token` with JWT and body containing `token`, `platform`, optional `deviceId`, and optional `appVersion`.
- Flutter listens for token refresh from Firebase Messaging. When a new token appears, Flutter calls `POST /devices/fcm-token` again with the new token.
- On logout, Flutter calls `DELETE /devices/fcm-token` with the current token before clearing local auth state when possible.

### 6.2 Message Notification Tap Flow

- Flutter receives a push notification with `data.type = message`.
- When the user taps the notification, Flutter reads `conversationId` from the data payload.
- Flutter navigates to `ChatDetailPage(conversationId: conversationId)`.
- `ChatDetailPage` calls APIs to fetch conversation/messages if local cache is incomplete.
- If the app is terminated, Flutter must handle the initial notification message after app startup and auth state restoration.
- If the user is not logged in or JWT expired when tapping the notification, Flutter navigates to login, then opens `ChatDetailPage` after successful auth when `conversationId` is still valid.

### 6.3 Foreground Flow

- When the app is foreground and socket is connected/joined to the conversation room, Flutter prioritizes Socket.IO `new_message` for realtime UI updates.
- Foreground push may be suppressed or shown as a local notification according to Flutter UX, but must not create duplicate messages in UI.
- Client must dedupe messages by server `message.id` when both Socket.IO and push/data message are received for the same message.

## 7. Test Cases

### POST /devices/fcm-token

- Registers a new FCM token for the authenticated user successfully.
- Calling again with the same token updates `lastUsedAt`, `platform`, `deviceId`, and `appVersion` when provided.
- Transfers token ownership to the new user when the same device logs in with another account.
- Reactivates a revoked token when the current user sends it again and it is valid.
- Rejects missing JWT with status 401.
- Rejects invalid or expired JWT with status 401.
- Returns 400 when `token` is empty after trim.
- Returns 400 when `platform` is not a valid enum value.
- Response does not return raw FCM token, password hash, refresh token, or security fields.

### DELETE /devices/fcm-token

- Revokes the current user's token successfully.
- Calling again with an already revoked token still returns an idempotent response.
- Does not reveal tokens owned by another user.
- Rejects missing JWT with status 401.
- Rejects invalid or expired JWT with status 401.
- Returns 400 when `token` is empty after trim.

### Message Push Integration

- After `send_message` persists successfully, backend emits Socket.IO `new_message`.
- Backend sends FCM to offline receiver.
- Backend sends FCM to background receiver when there is no active socket in the conversation room.
- Backend does not send FCM to receiver who is online and active in the conversation room.
- Backend does not send FCM to sender.
- Backend uses only non-revoked device tokens for the receiver.
- FCM data payload contains `type = message`, `conversationId`, and `senderId`.
- FCM errors do not fail persisted message or `send_message` ack.
- Invalid tokens from Firebase are marked revoked.
- If receiver has multiple active devices, backend sends FCM to all valid tokens.

### Flutter Handling

- After login, Flutter gets FCM token and calls `POST /devices/fcm-token`.
- When Firebase refreshes token, Flutter registers the new token with backend.
- On logout, Flutter calls `DELETE /devices/fcm-token`.
- When user taps notification `type = message`, Flutter opens the correct `ChatDetailPage` by `conversationId`.
- When app is terminated and opened from notification, Flutter routes correctly after restoring auth state.
- When both Socket.IO and push are received for the same message, Flutter does not create a duplicate chat item.

## 8. Error Cases

REST error responses should use the shared shape:

```json
{
  "success": false,
  "error": {
    "code": "DEVICE_TOKEN_INVALID",
    "message": "Invalid FCM token."
  }
}
```

| Case | HTTP Status / Internal | Error Code | Message |
| --- | --- | --- | --- |
| Missing bearer token | 401 | `AUTH_UNAUTHORIZED` | `Authentication is required.` |
| Invalid or expired JWT | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired token.` |
| `token` empty after trim | 400 | `VALIDATION_ERROR` | `FCM token is required.` |
| `token` exceeds allowed length | 400 | `VALIDATION_ERROR` | `FCM token is too long.` |
| Invalid `platform` | 400 | `VALIDATION_ERROR` | `Invalid device platform.` |
| `deviceId` exceeds allowed length | 400 | `VALIDATION_ERROR` | `Device id is too long.` |
| `appVersion` exceeds allowed length | 400 | `VALIDATION_ERROR` | `App version is too long.` |
| Token belongs to another user on DELETE | 200 | none | Do not reveal token ownership |
| Firebase credential missing or invalid | internal log | `PUSH_PROVIDER_UNAVAILABLE` | Do not fail message send ack |
| Firebase reports invalid/not registered token | internal handling | `PUSH_TOKEN_REVOKED` | Mark token revoked |
| Firebase send timeout | internal log/retry policy optional | `PUSH_SEND_FAILED` | Do not roll back message |
| Receiver has no valid token | internal no-op | none | Do not create an error for sender |
| Invalid `conversationId` in Flutter payload | client handling | `INVALID_NOTIFICATION_PAYLOAD` | Ignore notification or open inbox |
| User not logged in when tapping notification | client handling | `AUTH_REQUIRED` | Open login then continue route if valid |

Push provider errors happen after persistence. Backend must prioritize correctness
of message storage and Socket.IO events; FCM failures are logged and token state
is handled when possible.
