export type MediaModerationLabel =
  | 'neutral'
  | 'sexy'
  | 'porn'
  | 'hentai'
  | 'blood'
  | 'drawings'
  | 'unknown';

export type MappedMediaCategory =
  | 'safe'
  | 'suggestive'
  | 'sexual_explicit'
  | 'explicit_anime'
  | 'blood_gore'
  | 'drawings_artwork'
  | 'unknown';

export type MediaKind = 'image' | 'video';

export type ModerationAction = 'allow' | 'blur_allow_open' | 'blur_no_open' | 'block';

export interface ImagePrediction {
  label: string;
  confidence: number;
}

export interface VideoFramePrediction {
  frame: number;
  label: string;
  confidence: number;
}

export interface ModerationDecision {
  original_label: string;
  mapped_category: MappedMediaCategory;
  confidence: number;
  media_type: MediaKind;
  action: ModerationAction;
  can_open: boolean;
  should_blur: boolean;
  reason: string;
}

export interface ModerateMediaRequest {
  url: string;
  mediaKind: MediaKind;
  mimeType: string;
}

export interface MediaModerationProviderResult {
  label?: string;
  confidence?: number;
  predictions?: ImagePrediction | VideoFramePrediction[];
  model?: string;
  raw?: unknown;
}

export interface MediaModerationResult {
  mediaKind: MediaKind;
  decision: ModerationDecision;
  model: string;
  raw?: unknown;
}
