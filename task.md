# Backend Next Tasks

## Priority 1

- [x] Hoan thien `replies` thanh CRUD day du.
- [x] Them `GET /replies/:id`.
- [x] Them `PATCH /replies/:id`.
- [x] Them `DELETE /replies/:id` theo soft delete.
- [x] Enforce ownership khi sua va xoa reply.
- [x] Cap nhat lai `replyCount` va `childReplyCount` khi xoa reply.

- [x] Hoan thien follow/social graph.
- [x] Them API danh sach `followers`.
- [x] Them API danh sach `following`.
- [x] Them cursor pagination cho 2 danh sach follow.
- [x] Tao notification khi follow user.
- [x] Can nhac tach follow thanh `follows` module rieng sau khi core flow on dinh.

- [x] Sua cac counter nghiep vu de dam bao du lieu nhat quan.
- [x] Tang `postCount` khi tao post.
- [x] Giam `postCount` khi soft delete post.
- [x] Giam cac counter lien quan khi soft delete reply.
- [x] Dieu chinh logic unlike/recount trong `reactions` de an toan hon trong transaction.

## Priority 2

- [x] Them endpoint `notifications unread count` cho mobile badge.
- [x] Hoan thien chat flow cho mobile.
- [x] Them REST endpoint `mark seen` cho conversation/message.
- [x] Raa soat lai conversation preview va unread behavior.
- [x] Xac dinh ro message lifecycle, co the them soft delete message neu scope cho phep.

- [x] Tao `device tokens` module cho Flutter push flow.
- [x] Them API register device token.
- [x] Them API revoke device token.
- [x] Cap nhat `lastUsedAt` cho device token.
- [x] Them API list device token neu can cho noi bo.

- [x] Bo sung test business va e2e.
- [x] Them e2e cho auth.
- [x] Them e2e cho posts.
- [x] Them e2e cho replies.
- [x] Them e2e cho follows.
- [x] Them e2e cho notifications.
- [x] Them test cho ownership, soft delete, pagination, duplicate reaction/follow.

## Priority 3

- [x] Nang cap `uploads` tu upload file sang upload metadata + ownership/association ro rang voi post/reply/avatar.
- [x] Auth v2: logout, refresh token, doi mat khau.
- [x] Tach lai domain neu can: `follows`, `device-tokens`, response DTO consistency.

## Completed Advanced Scope

- [x] Message soft delete.
- [x] Upload association + orphan cleanup metadata.
- [x] Firebase Cloud Messaging push provider.
- [x] Auth refresh token rotation and logout revocation.
- [x] Change password and revoke active refresh tokens.
- [x] `FollowsModule` tach rieng khoi `UsersModule`.

## Suggested Sprint Order

1. Replies CRUD
2. Followers/Following APIs
3. Counter consistency
4. Notifications unread count
5. Device tokens
6. E2E coverage
