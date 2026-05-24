import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiErrorResponse, type UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';
import type { ImageStorageProvider } from './providers/image-storage.provider';
import type {
  ImageUploadRequest,
  StoredImage,
  StoredVideo,
  UploadImageType,
  VideoUploadRequest,
} from './types/upload-response.type';

const uploadFolderByType: Record<UploadImageType, string> = {
  post: 'posts',
  reply: 'replies',
  profile_avatar: 'avatars',
};

@Injectable()
export class CloudinaryProvider implements ImageStorageProvider {
  private readonly logger = new Logger(CloudinaryProvider.name);
  private readonly cloudName: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly rootFolder: string;

  constructor(private readonly configService: ConfigService) {
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim() || undefined;
    this.apiKey = this.configService.get<string>('CLOUDINARY_API_KEY')?.trim() || undefined;
    this.apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET')?.trim() || undefined;
    this.rootFolder =
      this.configService.get<string>('CLOUDINARY_UPLOAD_FOLDER', 'threads-like')?.trim() ||
      'threads-like';

    if (this.hasConfiguration()) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
    }
  }

  async uploadImage(input: ImageUploadRequest): Promise<StoredImage> {
    if (!this.hasConfiguration()) {
      this.logger.error(
        'Cloudinary provider is not configured. Missing CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET',
      );
      throw new ServiceUnavailableException({
        code: 'UPLOAD_PROVIDER_NOT_CONFIGURED',
        message: 'Cloudinary upload provider is not configured.',
      });
    }

    const result = await this.uploadToCloudinary(input);

    return {
      secureUrl: result.secure_url,
      publicId: result.public_id,
    };
  }

  async uploadVideo(input: VideoUploadRequest): Promise<StoredVideo> {
    if (!this.hasConfiguration()) {
      this.logger.error(
        'Cloudinary provider is not configured. Missing CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET',
      );
      throw new ServiceUnavailableException({
        code: 'UPLOAD_PROVIDER_NOT_CONFIGURED',
        message: 'Cloudinary upload provider is not configured.',
      });
    }

    const result = await this.uploadVideoToCloudinary(input);
    const durationSeconds = typeof result.duration === 'number' ? result.duration : 0;
    if (durationSeconds > input.maxDurationSeconds) {
      await this.deleteUploadedAsset(result.public_id, 'video');
      throw new BadRequestException({
        code: 'UPLOAD_VIDEO_DURATION_EXCEEDED',
        message: `Post video duration must be ${input.maxDurationSeconds} seconds or less.`,
      });
    }

    const eagerSecureUrl =
      Array.isArray(result.eager) &&
      result.eager.length > 0 &&
      typeof result.eager[0]?.secure_url === 'string' &&
      result.eager[0].secure_url.length > 0
        ? result.eager[0].secure_url
        : null;

    return {
      secureUrl: eagerSecureUrl ?? result.secure_url,
      publicId: result.public_id,
      durationSeconds,
    };
  }

  private uploadToCloudinary(input: ImageUploadRequest): Promise<UploadApiResponse> {
    const publicId = `${this.rootFolder}/${uploadFolderByType[input.type]}/${input.userId}/${randomUUID()}`;

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: publicId,
          overwrite: false,
          invalidate: false,
          unique_filename: false,
          use_filename: false,
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result?.secure_url || !result.public_id) {
            reject(new Error('Cloudinary upload did not return a secure URL and public ID.'));
            return;
          }

          resolve(result);
        },
      );

      uploadStream.end(input.file.buffer);
    });
  }

  private uploadVideoToCloudinary(input: VideoUploadRequest): Promise<UploadApiResponse> {
    const publicId = `${this.rootFolder}/posts/${input.userId}/${randomUUID()}`;

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          public_id: publicId,
          eager: [
            {
              format: 'mp4',
              video_codec: 'h264',
              audio_codec: 'aac',
            },
          ],
          overwrite: false,
          invalidate: false,
          unique_filename: false,
          use_filename: false,
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result?.secure_url || !result.public_id) {
            reject(new Error('Cloudinary video upload did not return a secure URL and public ID.'));
            return;
          }

          resolve(result);
        },
      );

      uploadStream.end(input.file.buffer);
    });
  }

  private hasConfiguration(): boolean {
    return (
      this.hasUsableCredential(this.cloudName, 'your-cloud-name') &&
      this.hasUsableCredential(this.apiKey, 'your-api-key') &&
      this.hasUsableCredential(this.apiSecret, 'your-api-secret')
    );
  }

  private hasUsableCredential(value: string | undefined, placeholder: string): boolean {
    return Boolean(value && value !== placeholder);
  }

  private async deleteUploadedAsset(publicId: string, resourceType: 'image' | 'video'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
      this.logger.error(
        `Failed to delete uploaded ${resourceType} asset after validation reject: ${publicId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

}
