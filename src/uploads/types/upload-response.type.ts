export type UploadImageType = 'post' | 'reply' | 'profile_avatar';

export interface UploadImageResponse {
  upload: {
    secureUrl: string;
    publicId: string;
    type: UploadImageType;
  };
}

export interface ImageUploadRequest {
  userId: string;
  file: Express.Multer.File;
  type: UploadImageType;
}

export interface StoredImage {
  secureUrl: string;
  publicId: string;
}
