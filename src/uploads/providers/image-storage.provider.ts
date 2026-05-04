import type { ImageUploadRequest, StoredImage } from '../types/upload-response.type';

export const IMAGE_STORAGE_PROVIDER = 'IMAGE_STORAGE_PROVIDER';

export interface ImageStorageProvider {
  uploadImage(input: ImageUploadRequest): Promise<StoredImage>;
}
