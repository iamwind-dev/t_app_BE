export type UploadImageType = 'post' | 'reply' | 'profile_avatar';

export interface UploadImageResponse {
  url: string;
  publicId: string;
  moderation: {
    original_label: string;
    mapped_category: string;
    confidence: number;
    media_type: 'image' | 'video';
    action: 'allow' | 'blur_allow_open' | 'blur_no_open' | 'block';
    can_open: boolean;
    should_blur: boolean;
    reason: string | null;
  };
}

export interface UploadVideoResponse {
  url: string;
  publicId: string;
  durationSeconds: number;
  moderation: {
    original_label: string;
    mapped_category: string;
    confidence: number;
    media_type: 'image' | 'video';
    action: 'allow' | 'blur_allow_open' | 'blur_no_open' | 'block';
    can_open: boolean;
    should_blur: boolean;
    reason: string | null;
  };
}

export interface ImageUploadRequest {
  userId: string;
  file: Express.Multer.File;
  type: UploadImageType;
}

export interface VideoUploadRequest {
  userId: string;
  file: Express.Multer.File;
  maxDurationSeconds: number;
}

export interface StoredImage {
  secureUrl: string;
  publicId: string;
}

export interface StoredVideo extends StoredImage {
  durationSeconds: number;
}
