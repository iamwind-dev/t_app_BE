import {
  BadGatewayException,
  HttpException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadImageDto } from './dto/upload-image.dto';
import { UploadVideoDto } from './dto/upload-video.dto';
import { IMAGE_STORAGE_PROVIDER } from './providers/image-storage.provider';
import type { ImageStorageProvider } from './providers/image-storage.provider';
import {
  UploadImageResponse,
  UploadImageType,
  UploadVideoResponse,
} from './types/upload-response.type';
import { PrismaService } from '../prisma/prisma.service';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedUploadTypes = new Set<UploadImageType>(['post', 'reply', 'profile_avatar']);
const defaultMaxImageSizeBytes = 5 * 1024 * 1024;
const allowedVideoMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const defaultMaxVideoSizeBytes = 25 * 1024 * 1024;
const maxPostVideoDurationSeconds = 10;
const defaultPendingUploadTtlHours = 24;

export type UploadAttachmentType = 'post' | 'reply' | 'profile_avatar';

interface SyncAttachedUploadsInput {
  ownerId: string;
  secureUrls: string[];
  expectedType: UploadImageType;
  attachedToType: UploadAttachmentType;
  attachedToId: string;
}

interface MarkResourceUploadsOrphanedInput {
  ownerId: string;
  attachedToType: UploadAttachmentType;
  attachedToId: string;
}

interface MarkOldPendingUploadsOrphanedInput {
  olderThan?: Date;
  ownerId?: string;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

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
        url: upload.secureUrl,
        publicId: upload.publicId,
      };
    } catch (error) {
      this.logger.error('Image upload failed', this.toErrorLogContext(error, userId, type));

      if (error instanceof HttpException) {
        throw error;
      }

      throw this.providerFailedException();
    }
  }

  async uploadPostVideo(
    userId: string,
    file: Express.Multer.File | undefined,
    _dto: UploadVideoDto,
  ): Promise<UploadVideoResponse> {
    this.validateVideoFile(file);

    try {
      const storedVideo = await this.storageProvider.uploadVideo({
        userId,
        file,
        maxDurationSeconds: maxPostVideoDurationSeconds,
      });

      if (!this.isValidProviderResponse(storedVideo.secureUrl, storedVideo.publicId)) {
        throw this.providerFailedException();
      }

      const upload = await this.prisma.upload.create({
        data: {
          ownerId: userId,
          secureUrl: storedVideo.secureUrl,
          publicId: storedVideo.publicId,
          type: 'post',
          mimeType: file.mimetype,
          sizeBytes: file.size,
          originalName: file.originalname || null,
        },
        select: {
          secureUrl: true,
          publicId: true,
        },
      });

      return {
        url: upload.secureUrl,
        publicId: upload.publicId,
        durationSeconds: storedVideo.durationSeconds,
      };
    } catch (error) {
      this.logger.error('Video upload failed', this.toErrorLogContext(error, userId, 'post'));

      if (error instanceof HttpException) {
        throw error;
      }

      throw this.providerFailedException();
    }
  }

  async syncAttachedUploads(input: SyncAttachedUploadsInput): Promise<void> {
    const secureUrls = this.uniqueSecureUrls(input.secureUrls);
    const now = new Date();

    if (secureUrls.length > 0) {
      await this.prisma.upload.updateMany({
        where: {
          ownerId: input.ownerId,
          type: input.expectedType,
          secureUrl: {
            in: secureUrls,
          },
          deletedAt: null,
        },
        data: {
          status: 'attached',
          attachedToType: input.attachedToType,
          attachedToId: input.attachedToId,
          attachedAt: now,
          orphanedAt: null,
        },
      });
    }

    await this.prisma.upload.updateMany({
      where: {
        ownerId: input.ownerId,
        type: input.expectedType,
        attachedToType: input.attachedToType,
        attachedToId: input.attachedToId,
        status: 'attached',
        deletedAt: null,
        ...(secureUrls.length > 0
          ? {
              secureUrl: {
                notIn: secureUrls,
              },
            }
          : {}),
      },
      data: {
        status: 'orphaned',
        orphanedAt: now,
      },
    });
  }

  async markResourceUploadsOrphaned(input: MarkResourceUploadsOrphanedInput): Promise<void> {
    await this.prisma.upload.updateMany({
      where: {
        ownerId: input.ownerId,
        attachedToType: input.attachedToType,
        attachedToId: input.attachedToId,
        status: 'attached',
        deletedAt: null,
      },
      data: {
        status: 'orphaned',
        orphanedAt: new Date(),
      },
    });
  }

  async markOldPendingUploadsOrphaned(
    input: MarkOldPendingUploadsOrphanedInput = {},
  ): Promise<{ count: number }> {
    const olderThan = input.olderThan ?? this.defaultPendingUploadCutoff();
    return this.prisma.upload.updateMany({
      where: {
        ...(input.ownerId ? { ownerId: input.ownerId } : {}),
        status: 'pending',
        deletedAt: null,
        createdAt: {
          lt: olderThan,
        },
      },
      data: {
        status: 'orphaned',
        orphanedAt: new Date(),
      },
    });
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

  private validateVideoFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file || file.size <= 0 || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'UPLOAD_FILE_REQUIRED',
        message: 'Video file is required.',
      });
    }

    const maxVideoSizeBytes = this.configService.get<number>(
      'UPLOAD_MAX_VIDEO_SIZE_BYTES',
      defaultMaxVideoSizeBytes,
    );

    if (file.size > maxVideoSizeBytes) {
      throw new PayloadTooLargeException({
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Video size exceeds allowed limit.',
      });
    }

    if (!allowedVideoMimeTypes.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'UPLOAD_INVALID_MIME_TYPE',
        message: 'Only MP4, MOV, and WEBM videos are allowed.',
      });
    }
  }

  private toErrorLogContext(error: unknown, userId: string, type: UploadImageType): string {
    const details = {
      userId,
      type,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    return JSON.stringify(details);
  }

  private uniqueSecureUrls(secureUrls: string[]): string[] {
    return [...new Set(secureUrls.map((url) => url.trim()).filter((url) => url.length > 0))];
  }

  private defaultPendingUploadCutoff(): Date {
    const pendingUploadTtlHours = this.configService.get<number>(
      'UPLOAD_PENDING_TTL_HOURS',
      defaultPendingUploadTtlHours,
    );

    return new Date(Date.now() - pendingUploadTtlHours * 60 * 60 * 1000);
  }
}
