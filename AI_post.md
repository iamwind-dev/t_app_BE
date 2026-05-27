# AI Post/Upload Moderation Summary

## Mục tiêu đã triển khai
- Bổ sung moderation cho media upload (ảnh/video) dựa trên model classification labels:
  - `neutral`, `sexy`, `porn`, `hentai`, `blood`, `drawings`
- Giữ nguyên AI text moderation cũ, chỉ thêm media moderation.
- Chuẩn hóa decision trả về theo format bạn yêu cầu.

## Mapping label gốc -> category hiển thị
- `neutral` -> `safe`
- `sexy` -> `suggestive`
- `porn` -> `sexual_explicit`
- `hentai` -> `explicit_anime`
- `blood` -> `blood_gore`
- `drawings` -> `drawings_artwork`

## Rule constants (dễ chỉnh)
- `CONFIDENCE_THRESHOLD = 0.70`
- `VIDEO_BLOCK_FRAME_RATIO = 0.10`
- `VIDEO_BLOOD_BLUR_RATIO = 0.20`

## Function chính đã thêm
- `moderateContent({ mediaType, predictions })` trong `ModerationService`
- Input:
  - Image: `{ label, confidence }`
  - Video: `[{ frame, label, confidence }, ...]`
- Output chuẩn:
```json
{
  "original_label": "string",
  "mapped_category": "string",
  "confidence": 0.0,
  "media_type": "image | video",
  "action": "allow | blur_allow_open | blur_no_open | block",
  "can_open": true,
  "should_blur": false,
  "reason": "string"
}
```

## Rule xử lý đã code

### 1) IMAGE
- Nếu `confidence < 0.70`: `allow` (vẫn lưu label/confidence để log/review)
- Nếu `confidence >= 0.70`:
  - `porn`/`hentai` -> `blur_no_open` (blur, không mở được)
  - `neutral`/`drawings`/`sexy`/`blood` -> `allow` (không blur)

### 2) VIDEO
- Với mỗi frame: frame nhạy cảm khi `confidence >= 0.70`
- Block video nếu:
  - Có ít nhất 1 frame `porn/hentai` nhạy cảm, hoặc
  - Tỷ lệ frame `porn/hentai` >= `10%`
  - Action: `block`
- Blur video nếu:
  - Tỷ lệ frame `blood` nhạy cảm >= `20%`
  - Action: `blur_allow_open`
- Còn lại: `allow` (bao gồm `sexy`)

## Luồng backend đã nối
- Sau upload ảnh/video: gọi AI media moderation, tính decision, lưu vào DB `Upload`.
- Khi tạo/cập nhật post/reply: kiểm tra media đã attach.
  - Nếu decision là `block` -> chặn publish (`MEDIA_BLOCKED`).

## Schema/Migration đã thêm
- Thêm các cột moderation media vào `Upload`:
  - `aiModerationStatus`, `aiModerationLabel`, `aiModerationConfidence`, `aiModerationRaw`
  - `mediaSafetyPolicy`, `mediaSafetyReason`
  - `mediaBlurSuggested`, `mediaRequiresClickToReveal`, `mediaVisibleByDefault`, `mediaBlockedFromPosting`
- Migration:
  - `prisma/migrations/20260527103000_upload_media_moderation/migration.sql`

## File đã chỉnh chính
- `prisma/schema.prisma`
- `src/modules/moderation/interfaces/media-moderation.interface.ts`
- `src/modules/moderation/moderation.provider.ts`
- `src/modules/moderation/moderation.service.ts`
- `src/uploads/uploads.service.ts`
- `src/uploads/uploads.module.ts`
- `src/uploads/types/upload-response.type.ts`
- `src/posts/posts.service.ts`
- `src/replies/replies.service.ts`
- `src/uploads/uploads.service.spec.ts`
- `src/posts/posts.service.spec.ts`
- `src/replies/replies.service.spec.ts`

## Ghi chú
- AI text moderation cũ vẫn giữ nguyên.
- Media moderation là phần thêm mới để xử lý ảnh/video trước khi publish.
