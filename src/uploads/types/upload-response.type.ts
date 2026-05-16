export type UploadImageType = 'post' | 'reply' | 'profile_avatar';

export interface UploadImageResponse {
  url: string;
  publicId: string;
}

export interface UploadVideoResponse {
  url: string;
  publicId: string;
  durationSeconds: number;
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
