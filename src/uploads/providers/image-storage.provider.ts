import type {
  ImageUploadRequest,
  StoredImage,
  StoredVideo,
  VideoUploadRequest,
} from '../types/upload-response.type';

export const IMAGE_STORAGE_PROVIDER = 'IMAGE_STORAGE_PROVIDER';

export interface ImageStorageProvider {
  uploadImage(input: ImageUploadRequest): Promise<StoredImage>;
  uploadVideo(input: VideoUploadRequest): Promise<StoredVideo>;
}
