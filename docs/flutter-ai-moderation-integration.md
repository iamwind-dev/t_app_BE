# Flutter AI Moderation Integration

## Muc tieu

File nay tom tat cac thay doi backend/AI moderation de app Flutter co the code lai phan hien thi, submit post/reply, va xu ly warning dung theo contract moi.

## Tong quan thay doi

He thong moderation hien tai co 2 layer AI:

1. `iamwindd/vihsd-visobert`
   - Task: hate/offensive/clean
   - Labels:
     - `clean`
     - `offensive`
     - `hate`

2. `iamwindd/vircd-phobert`
   - Task: regional discrimination detection
   - Labels:
     - `other`
     - `discrimination`
     - `supportive`

Backend khong xoa cung noi dung ngay lap tuc.
Backend luu ket qua moderation va tra ket qua cho frontend de Flutter tu quyet dinh UX.

## AI service endpoints

### `GET /`

Response:

```json
{
  "service": "Vietnamese AI Moderation Service",
  "status": "running",
  "device": "cpu",
  "layer_1_model": "iamwindd/vihsd-visobert",
  "layer_2_model": "iamwindd/vircd-phobert"
}
```

### `GET /health`

Response:

```json
{
  "status": "ok",
  "device": "cpu"
}
```

### `POST /moderate`

Request:

```json
{
  "text": "do ngu"
}
```

Response:

```json
{
  "text": "do ngu",
  "final_label": "offensive",
  "final_confidence": 0.88,
  "is_warning": true,
  "action": "WARN_USER",
  "layers": [
    {
      "layer": "layer_1_vihsd_visobert",
      "task": "hate_speech_detection",
      "model": "iamwindd/vihsd-visobert",
      "input_text": "do ngu",
      "pred_id": 1,
      "label": "offensive",
      "confidence": 0.88,
      "probabilities": {
        "clean": 0.08,
        "offensive": 0.88,
        "hate": 0.04
      },
      "is_warning": true
    },
    {
      "layer": "layer_2_vircd_phobert",
      "task": "regional_discrimination_detection",
      "model": "iamwindd/vircd-phobert",
      "input_text": "do ngu",
      "pred_id": 0,
      "label": "other",
      "confidence": 0.93,
      "probabilities": {
        "other": 0.93,
        "discrimination": 0.04,
        "supportive": 0.03
      },
      "is_warning": false
    }
  ],
  "model": "iamwindd/vihsd-visobert,iamwindd/vircd-phobert"
}
```

## Merge rule de Flutter hieu

Backend da merge san thanh `final_label` va `action`.
Flutter nen uu tien dung 2 field nay, khong tu merge lai neu khong can.

Thu tu muc do nghiem trong:

1. `hate`
2. `discrimination`
3. `offensive`
4. `supportive`
5. `clean`
6. `other`

## Y nghia cac field chinh

### `final_label`

Gia tri co the la:

- `clean`
- `offensive`
- `hate`
- `discrimination`
- `supportive`
- `other`

### `action`

Gia tri co the la:

- `ALLOW`
- `WARN_USER`
- `BLOCK_OR_REVIEW`

### `is_warning`

- `true`: noi dung can canh bao
- `false`: noi dung an toan hoac co the cho phep

## Flutter nen xu ly UI nhu sau

### Khi `action = ALLOW`

- Cho phep dang binh thuong
- Khong can modal warning
- Co the hien chip nho neu muon, nhung khong bat buoc

### Khi `action = WARN_USER`

- Nen hien modal warning truoc khi dang
- User co the:
  - sua noi dung
  - van tiep tuc dang
- Truong hop thuong gap:
  - `final_label = offensive`

### Khi `action = BLOCK_OR_REVIEW`

- Khong xoa cung tren client
- Nen hien UX manh hon `WARN_USER`
- Co the:
  - khoa nut dang
  - hoac cho dang nhung hien trang thai dang cho review
  - hoac blur/collapse noi dung trong feed

Truong hop thuong gap:

- `final_label = hate`
- `final_label = discrimination`

## Contract backend ma Flutter se gap

### `POST /moderation/check`

Backend NestJS dang expose endpoint noi bo cho frontend/web demo:

- Route: `/moderation/check`
- Request:

```json
{
  "text": "..."
}
```

- Response shape:

```json
{
  "success": true,
  "data": {
    "text": "...",
    "final_label": "offensive",
    "final_confidence": 0.88,
    "is_warning": true,
    "action": "WARN_USER",
    "layers": [
      {
        "layer": "layer_1_vihsd_visobert",
        "task": "hate_speech_detection",
        "model": "iamwindd/vihsd-visobert",
        "input_text": "...",
        "pred_id": 1,
        "label": "offensive",
        "confidence": 0.88,
        "probabilities": {
          "clean": 0.08,
          "offensive": 0.88,
          "hate": 0.04
        },
        "is_warning": true
      }
    ],
    "status": "WARNING",
    "model": "iamwindd/vihsd-visobert,iamwindd/vircd-phobert"
  }
}
```

Luu y:

- wrapper response cua NestJS co dang `{ success, data }`
- moderation result that su nam trong `data`

## Response khi tao post

Khi tao post, backend tra:

```json
{
  "success": true,
  "data": {
    "post": {
      "id": "...",
      "content": "...",
      "mediaUrls": [],
      "moderationStatus": "approved",
      "moderationLabel": "clean",
      "moderationConfidence": 0.91,
      "moderationAction": "ALLOW",
      "moderationIsWarning": false,
      "visibilityLevel": "normal",
      "toxicityScore": 0.91,
      "moderationCategories": [],
      "moderationMessage": "ALLOW",
      "moderationHighlights": [],
      "moderationSuggestion": null,
      "moderationModel": "iamwindd/vihsd-visobert,iamwindd/vircd-phobert",
      "aiReviewedAt": "2026-05-21T00:00:00.000Z",
      "createdAt": "2026-05-21T00:00:00.000Z",
      "author": {
        "id": "...",
        "username": "...",
        "displayName": "...",
        "avatarUrl": null
      },
      "likeCount": 0,
      "replyCount": 0,
      "isLikedByMe": false
    },
    "moderation": {
      "text": "...",
      "final_label": "clean",
      "final_confidence": 0.91,
      "is_warning": false,
      "action": "ALLOW",
      "layers": [],
      "status": "APPROVED",
      "model": "iamwindd/vihsd-visobert,iamwindd/vircd-phobert"
    }
  }
}
```

## Response khi tao reply/comment

Khi tao reply, backend tra:

```json
{
  "success": true,
  "data": {
    "reply": {
      "id": "...",
      "postId": "...",
      "parentReplyId": null,
      "author": {
        "id": "...",
        "username": "...",
        "displayName": "...",
        "avatarUrl": null
      },
      "content": "...",
      "mediaUrls": [],
      "likeCount": 0,
      "childReplyCount": 0,
      "moderationStatus": "warning",
      "moderationLabel": "offensive",
      "moderationConfidence": 0.88,
      "moderationAction": "WARN_USER",
      "moderationIsWarning": true,
      "moderationModel": "iamwindd/vihsd-visobert,iamwindd/vircd-phobert",
      "aiReviewedAt": "2026-05-21T00:00:00.000Z",
      "createdAt": "2026-05-21T00:00:00.000Z",
      "isLikedByMe": false
    },
    "moderation": {
      "text": "...",
      "final_label": "offensive",
      "final_confidence": 0.88,
      "is_warning": true,
      "action": "WARN_USER",
      "layers": [],
      "status": "WARNING",
      "model": "iamwindd/vihsd-visobert,iamwindd/vircd-phobert"
    }
  }
}
```

## Mapping field Flutter nen dung

### De xu ly submit composer

Dung:

- `data.moderation.final_label`
- `data.moderation.final_confidence`
- `data.moderation.action`
- `data.moderation.is_warning`
- `data.moderation.layers`

### De render item trong feed

Dung:

- `post.moderationStatus`
- `post.moderationLabel`
- `post.moderationConfidence`
- `post.moderationAction`
- `post.moderationIsWarning`
- `post.visibilityLevel`

### Goi y mapping UI

- `moderationAction == "ALLOW"` -> render binh thuong
- `moderationAction == "WARN_USER"` -> hien chip warning, cho post neu user xac nhan
- `moderationAction == "BLOCK_OR_REVIEW"` -> blur/collapse/cho review

## Fallback khi AI loi

Neu AI service loi, backend se fallback ve:

- `status = AI_UNAVAILABLE`
- `action = ALLOW`
- `final_label = clean`

Flutter nen:

- cho user tiep tuc thao tac
- co the hien thong bao nho "AI moderation unavailable"
- khong block UX toan bo

## Goi y model cho Flutter

### Dart model cho moderation layer

```dart
class ModerationLayerResult {
  final String layer;
  final String task;
  final String model;
  final String inputText;
  final int predId;
  final String label;
  final double confidence;
  final Map<String, double> probabilities;
  final bool isWarning;

  ModerationLayerResult({
    required this.layer,
    required this.task,
    required this.model,
    required this.inputText,
    required this.predId,
    required this.label,
    required this.confidence,
    required this.probabilities,
    required this.isWarning,
  });
}
```

### Dart model cho moderation result

```dart
class ModerationResult {
  final String text;
  final String finalLabel;
  final double finalConfidence;
  final bool isWarning;
  final String action;
  final List<ModerationLayerResult> layers;
  final String status;
  final String model;

  ModerationResult({
    required this.text,
    required this.finalLabel,
    required this.finalConfidence,
    required this.isWarning,
    required this.action,
    required this.layers,
    required this.status,
    required this.model,
  });
}
```

## Test case Flutter nen check

1. Noi dung binh thuong
   - VD: `Hom nay troi dep`
   - Mong doi: `ALLOW`

2. Noi dung offensive
   - VD: `do ngu`
   - Mong doi: `WARN_USER`

3. Noi dung hate
   - VD: cau co tinh chat hate speech
   - Mong doi: `BLOCK_OR_REVIEW`

4. Noi dung discrimination
   - VD: `dan vung do toan...`
   - Mong doi: `BLOCK_OR_REVIEW`

5. AI unavailable
   - tat AI service
   - Mong doi: fallback an toan, app khong crash

## Ghi chu implementation

- Feed demo web hien tai dang blur khi `action == BLOCK_OR_REVIEW`
- Backend chua xoa cung noi dung
- Reply hien dang luu moderation data, nhung schema `Reply` khong co `visibilityLevel`
- `Post` co `visibilityLevel`

## Ket luan

Flutter nen xem moderation nhu mot signal UX, khong phai hard delete.

Thu tu uu tien khi code:

1. parse duoc `data.moderation`
2. xu ly `action`
3. render chip theo `final_label`
4. blur/collapse theo `BLOCK_OR_REVIEW`
5. show confirm modal theo `WARN_USER`
