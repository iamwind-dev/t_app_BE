# Backend Next Tasks

## Priority 1

- [ ] Hoan thien `replies` thanh CRUD day du.
- [ ] Them `GET /replies/:id`.
- [ ] Them `PATCH /replies/:id`.
- [ ] Them `DELETE /replies/:id` theo soft delete.
- [ ] Enforce ownership khi sua va xoa reply.
- [ ] Cap nhat lai `replyCount` va `childReplyCount` khi xoa reply.

- [ ] Hoan thien follow/social graph.
- [ ] Them API danh sach `followers`.
- [ ] Them API danh sach `following`.
- [ ] Them cursor pagination cho 2 danh sach follow.
- [ ] Tao notification khi follow user.
- [ ] Can nhac tach follow thanh `follows` module rieng sau khi core flow on dinh.

- [ ] Sua cac counter nghiep vu de dam bao du lieu nhat quan.
- [ ] Tang `postCount` khi tao post.
- [ ] Giam `postCount` khi soft delete post.
- [ ] Giam cac counter lien quan khi soft delete reply.
- [ ] Dieu chinh logic unlike/recount trong `reactions` de an toan hon trong transaction.

## Priority 2

- [ ] Them endpoint `notifications unread count` cho mobile badge.
- [ ] Hoan thien chat flow cho mobile.
- [ ] Them REST endpoint `mark seen` cho conversation/message.
- [ ] Raa soat lai conversation preview va unread behavior.
- [ ] Xac dinh ro message lifecycle, co the them soft delete message neu scope cho phep.

- [ ] Tao `device tokens` module cho Flutter push flow.
- [ ] Them API register device token.
- [ ] Them API revoke device token.
- [ ] Cap nhat `lastUsedAt` cho device token.
- [ ] Them API list device token neu can cho noi bo.

- [ ] Bo sung test business va e2e.
- [ ] Them e2e cho auth.
- [ ] Them e2e cho posts.
- [ ] Them e2e cho replies.
- [ ] Them e2e cho follows.
- [ ] Them e2e cho notifications.
- [ ] Them test cho ownership, soft delete, pagination, duplicate reaction/follow.

## Priority 3

- [ ] Nang cap `uploads` tu upload file sang upload metadata + ownership/association ro rang voi post/reply/avatar.
- [ ] Auth v2: logout, refresh token, doi mat khau.
- [ ] Tach lai domain neu can: `follows`, `device-tokens`, response DTO consistency.

## Suggested Sprint Order

1. Replies CRUD
2. Followers/Following APIs
3. Counter consistency
4. Notifications unread count
5. Device tokens
6. E2E coverage
