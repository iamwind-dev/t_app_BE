import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadImageDto } from './dto/upload-image.dto';
import { IMAGE_STORAGE_PROVIDER } from './providers/image-storage.provider';
import type { ImageStorageProvider } from './providers/image-storage.provider';
import { UploadImageResponse, UploadImageType } from './types/upload-response.type';
import { PrismaService } from '../prisma/prisma.service';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedUploadTypes = new Set<UploadImageType>(['post', 'reply', 'profile_avatar']);
const defaultMaxImageSizeBytes = 5 * 1024 * 1024;

@Injectable()
export class UploadsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(IMAGE_STORAGE_PROVIDER)
    private readonly storageProvider: ImageStorageProvider,
  ) {}

  async uploadImage(
    userId: string,
    file: Express.Multer.File | undefined,
    dto: UploadImageDto,
  ): Promise<UploadImageResponse> {
    const type = this.validateUploadType(dto.type);
    this.validateFile(file);

    try {
      const storedImage = await this.storageProvider.uploadImage({
        userId,
        file,
        type,
      });

      if (!this.isValidProviderResponse(storedImage.secureUrl, storedImage.publicId)) {
        throw this.providerFailedException();
      }

      const upload = await this.prisma.upload.create({
        data: {
          ownerId: userId,
          secureUrl: storedImage.secureUrl,
          publicId: storedImage.publicId,
          type,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          originalName: file.originalname || null,
        },
        select: {
          id: true,
          secureUrl: true,
          publicId: true,
          type: true,
        },
      });

      return {
        upload: {
          id: upload.id,
          secureUrl: upload.secureUrl,
          publicId: upload.publicId,
          type: upload.type as UploadImageType,
        },
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw this.providerFailedException();
    }
  }

  private validateUploadType(type: string): UploadImageType {
    const normalizedType = type?.trim() as UploadImageType;

    if (!allowedUploadTypes.has(normalizedType)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Upload type is invalid.',
      });
    }

    return normalizedType;
  }

  private validateFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file || file.size <= 0 || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'UPLOAD_FILE_REQUIRED',
        message: 'Image file is required.',
      });
    }

    const maxImageSizeBytes = this.configService.get<number>(
      'UPLOAD_MAX_IMAGE_SIZE_BYTES',
      defaultMaxImageSizeBytes,
    );

    if (file.size > maxImageSizeBytes) {
      throw new PayloadTooLargeException({
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Image size must not exceed 5 MB.',
      });
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'UPLOAD_INVALID_MIME_TYPE',
        message: 'Only JPEG, PNG, and WebP images are allowed.',
      });
    }
  }

  private isValidProviderResponse(secureUrl: string, publicId: string): boolean {
    return secureUrl.startsWith('https://') && publicId.trim().length > 0;
  }

  private providerFailedException(): BadGatewayException {
    return new BadGatewayException({
      code: 'UPLOAD_PROVIDER_FAILED',
      message: 'Image upload failed. Please try again.',
    });
  }
}
