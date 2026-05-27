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
import { ModerationService } from '../modules/moderation/moderation.service';
import { MediaKind } from '../modules/moderation/interfaces/media-moderation.interface';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedUploadTypes = new Set<UploadImageType>(['post', 'reply', 'profile_avatar']);
const defaultMaxImageSizeBytes = 5 * 1024 * 1024;
const allowedVideoMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const defaultMaxVideoSizeBytes = 100 * 1024 * 1024;
const maxPostVideoDurationSeconds = 60;
const defaultPendingUploadTtlHours = 24;
const maxUploadOriginalNameLength = 255;

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

interface UploadSafetyRecord {
  id: string;
  secureUrl: string;
  mimeType: string;
  aiModerationStatus: string;
  mediaBlockedFromPosting: boolean;
  mediaSafetyPolicy: string;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
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
          originalName: this.normalizeOriginalName(file.originalname),
        },
        select: {
          id: true,
          secureUrl: true,
          publicId: true,
          type: true,
          mimeType: true,
        },
      });

      const moderation = await this.moderateAndPersistUpload(upload.id, upload.secureUrl, upload.mimeType);

      return {
        url: upload.secureUrl,
        publicId: upload.publicId,
        moderation,
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
          originalName: this.normalizeOriginalName(file.originalname),
        },
        select: {
          id: true,
          secureUrl: true,
          publicId: true,
          mimeType: true,
        },
      });

      const moderation = await this.moderateAndPersistUpload(upload.id, upload.secureUrl, upload.mimeType);

      return {
        url: upload.secureUrl,
        publicId: upload.publicId,
        durationSeconds: storedVideo.durationSeconds,
        moderation,
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

  async assertMediaAllowedForPublishing(input: {
    ownerId: string;
    secureUrls: string[];
    expectedType: UploadImageType;
  }): Promise<void> {
    const secureUrls = this.uniqueSecureUrls(input.secureUrls);
    if (secureUrls.length === 0) {
      return;
    }

    const uploads = (await this.prisma.upload.findMany({
      where: {
        ownerId: input.ownerId,
        type: input.expectedType,
        secureUrl: {
          in: secureUrls,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        secureUrl: true,
        mimeType: true,
        aiModerationStatus: true,
        mediaBlockedFromPosting: true,
        mediaSafetyPolicy: true,
      },
    })) as UploadSafetyRecord[];

    const foundUrls = new Set(uploads.map((item) => item.secureUrl));
    const missingUrl = secureUrls.find((url) => !foundUrls.has(url));
    if (missingUrl) {
      throw new BadRequestException({
        code: 'UPLOAD_NOT_FOUND',
        message: 'One or more media URLs are invalid or not owned by this user.',
      });
    }

    for (const upload of uploads) {
      if (upload.aiModerationStatus === 'PENDING') {
        await this.moderateAndPersistUpload(upload.id, upload.secureUrl, upload.mimeType);
      }
    }

    const refreshed = (await this.prisma.upload.findMany({
      where: {
        id: {
          in: uploads.map((item) => item.id),
        },
      },
      select: {
        mediaBlockedFromPosting: true,
        mediaSafetyReason: true,
      },
    })) as Array<{ mediaBlockedFromPosting: boolean; mediaSafetyReason: string | null }>;

    const blocked = refreshed.find((item) => item.mediaBlockedFromPosting);
    if (blocked) {
      throw new BadRequestException({
        code: 'MEDIA_BLOCKED',
        message: blocked.mediaSafetyReason ?? 'Media is blocked by safety policy.',
      });
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
      errorMessage: this.toErrorMessage(error),
      errorDetails: error instanceof Error ? undefined : this.toSerializableError(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    return JSON.stringify(details);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return JSON.stringify(this.toSerializableError(error));
  }

  private toSerializableError(error: unknown): unknown {
    if (typeof error !== 'object' || error === null) {
      return error;
    }

    return Object.fromEntries(
      Object.entries(error).map(([key, value]) => [
        key,
        typeof value === 'function' ? '[Function]' : value,
      ]),
    );
  }

  private uniqueSecureUrls(secureUrls: string[]): string[] {
    return [...new Set(secureUrls.map((url) => url.trim()).filter((url) => url.length > 0))];
  }

  private normalizeOriginalName(originalName: string | null | undefined): string | null {
    if (!originalName) {
      return null;
    }

    const normalized = originalName.trim();
    if (normalized.length === 0) {
      return null;
    }

    return normalized.slice(0, maxUploadOriginalNameLength);
  }

  private defaultPendingUploadCutoff(): Date {
    const pendingUploadTtlHours = this.configService.get<number>(
      'UPLOAD_PENDING_TTL_HOURS',
      defaultPendingUploadTtlHours,
    );

    return new Date(Date.now() - pendingUploadTtlHours * 60 * 60 * 1000);
  }

  private async moderateAndPersistUpload(
    uploadId: string,
    secureUrl: string,
    mimeType: string,
  ): Promise<{
    original_label: string;
    mapped_category: string;
    confidence: number;
    media_type: 'image' | 'video';
    action: 'allow' | 'blur_allow_open' | 'blur_no_open' | 'block';
    can_open: boolean;
    should_blur: boolean;
    reason: string | null;
  }> {
    const mediaKind: MediaKind = mimeType.startsWith('video/') ? 'video' : 'image';
    const moderationResult = await this.moderationService.moderateMedia({
      url: secureUrl,
      mediaKind,
      mimeType,
    });
    const decision = moderationResult.decision;
    const aiLabel = decision.original_label === 'unknown' ? null : decision.original_label;
    const policy = this.toPolicyFromAction(decision.action);
    const blockedFromPosting = decision.action === 'block';
    const canOpen = decision.can_open;

    await this.prisma.upload.update({
      where: { id: uploadId },
      data: {
        aiModerationStatus: decision.original_label === 'unknown' ? 'AI_UNAVAILABLE' : 'APPROVED',
        aiModerationLabel: aiLabel,
        aiModerationConfidence: decision.confidence,
        aiModerationRaw: moderationResult.raw ?? moderationResult,
        mediaSafetyPolicy: policy,
        mediaSafetyReason: decision.reason,
        mediaBlurSuggested: decision.should_blur,
        mediaRequiresClickToReveal: decision.should_blur && canOpen,
        mediaVisibleByDefault: !decision.should_blur,
        mediaBlockedFromPosting: blockedFromPosting,
      },
    });

    return {
      original_label: decision.original_label,
      mapped_category: decision.mapped_category,
      confidence: decision.confidence,
      media_type: decision.media_type,
      action: decision.action,
      can_open: decision.can_open,
      should_blur: decision.should_blur,
      reason: decision.reason,
    };
  }

  private toPolicyFromAction(action: 'allow' | 'blur_allow_open' | 'blur_no_open' | 'block'): string {
    switch (action) {
      case 'blur_allow_open':
        return 'BLUR_ALLOW_OPEN';
      case 'blur_no_open':
        return 'BLUR_NO_OPEN';
      case 'block':
        return 'BLOCK';
      default:
        return 'NORMAL';
    }
  }
}
