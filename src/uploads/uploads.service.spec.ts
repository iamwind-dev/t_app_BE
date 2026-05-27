import { BadGatewayException, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { IMAGE_STORAGE_PROVIDER } from './providers/image-storage.provider';
import type { ImageStorageProvider } from './providers/image-storage.provider';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../modules/moderation/moderation.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let storageProvider: ImageStorageProvider & {
    uploadImage: jest.Mock;
    uploadVideo: jest.Mock;
  };
  let prisma: {
    upload: {
      create: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let moderationService: {
    moderateMedia: jest.Mock;
    toMediaSafetyDecision: jest.Mock;
  };

  const userId = '7b8c5a41-7d25-4e76-b2b5-1f3f1b2a78a1';
  const imageFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image'),
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
  };

  beforeEach(() => {
    storageProvider = {
      uploadImage: jest.fn(),
      uploadVideo: jest.fn(),
    };
    prisma = {
      upload: {
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    moderationService = {
      moderateMedia: jest.fn().mockImplementation((input: { mediaKind: 'image' | 'video' }) =>
        Promise.resolve({
          mediaKind: input.mediaKind,
          decision: {
            original_label: 'neutral',
            mapped_category: 'safe',
            confidence: 0.98,
            media_type: input.mediaKind,
            action: 'allow',
            can_open: true,
            should_blur: false,
            reason: 'Allowed image category.',
          },
          model: 'test-model',
          raw: {},
        }),
      ),
      toMediaSafetyDecision: jest.fn(),
    };

    service = new UploadsService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'UPLOAD_MAX_IMAGE_SIZE_BYTES') {
            return 5 * 1024 * 1024;
          }

          return fallback;
        }),
      } as never,
      prisma as unknown as PrismaService,
      moderationService as unknown as ModerationService,
      storageProvider,
    );
  });

  it('uploads a valid image through the configured storage provider', async () => {
    storageProvider.uploadImage.mockResolvedValue({
      secureUrl: 'https://cdn.example.com/uploads/posts/public-id.jpg',
      publicId: 'uploads/posts/public-id',
    });
    prisma.upload.create.mockResolvedValue({
      id: 'upload-id',
      secureUrl: 'https://cdn.example.com/uploads/posts/public-id.jpg',
      publicId: 'uploads/posts/public-id',
      type: 'post',
      mimeType: 'image/jpeg',
    });

    const result = await service.uploadImage(userId, imageFile, {
      type: ' post ' as unknown as 'post',
    });

    expect(storageProvider.uploadImage).toHaveBeenCalledWith({
      userId,
      file: imageFile,
      type: 'post',
    });
    expect(prisma.upload.create).toHaveBeenCalledWith({
      data: {
        ownerId: userId,
        secureUrl: 'https://cdn.example.com/uploads/posts/public-id.jpg',
        publicId: 'uploads/posts/public-id',
        type: 'post',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        originalName: 'photo.jpg',
      },
      select: {
        id: true,
        secureUrl: true,
        publicId: true,
        type: true,
        mimeType: true,
      },
    });
    expect(result).toEqual({
      url: 'https://cdn.example.com/uploads/posts/public-id.jpg',
      publicId: 'uploads/posts/public-id',
      moderation: {
        original_label: 'neutral',
        mapped_category: 'safe',
        confidence: 0.98,
        media_type: 'image',
        action: 'allow',
        can_open: true,
        should_blur: false,
        reason: 'Allowed image category.',
      },
    });
  });

  it('rejects a missing or empty image file', async () => {
    await expect(service.uploadImage(userId, undefined, { type: 'post' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.uploadImage(userId, { ...imageFile, size: 0, buffer: Buffer.alloc(0) }, { type: 'post' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unsupported image mime types', async () => {
    await expect(
      service.uploadImage(userId, { ...imageFile, mimetype: 'image/gif' }, { type: 'post' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects files larger than the configured maximum', async () => {
    await expect(
      service.uploadImage(userId, { ...imageFile, size: 5 * 1024 * 1024 + 1 }, { type: 'post' }),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('rejects unsupported upload types', async () => {
    await expect(
      service.uploadImage(userId, imageFile, { type: 'cover' as unknown as 'post' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps provider failures and invalid provider responses to a stable error', async () => {
    storageProvider.uploadImage.mockResolvedValue({
      secureUrl: 'http://cdn.example.com/not-secure.jpg',
      publicId: 'uploads/posts/not-secure',
    });

    await expect(service.uploadImage(userId, imageFile, { type: 'post' })).rejects.toThrow(
      BadGatewayException,
    );

    storageProvider.uploadImage.mockRejectedValue(new Error('provider failed'));

    await expect(service.uploadImage(userId, imageFile, { type: 'post' })).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('uses the image storage provider injection token', () => {
    expect(IMAGE_STORAGE_PROVIDER).toBe('IMAGE_STORAGE_PROVIDER');
  });

  it('uploads a valid post video with max duration enforcement delegated to provider', async () => {
    storageProvider.uploadVideo.mockResolvedValue({
      secureUrl: 'https://cdn.example.com/uploads/posts/video.mp4',
      publicId: 'uploads/posts/video',
      durationSeconds: 59.4,
    });
    prisma.upload.create.mockResolvedValue({
      id: 'upload-id',
      secureUrl: 'https://cdn.example.com/uploads/posts/video.mp4',
      publicId: 'uploads/posts/video',
      mimeType: 'video/mp4',
    });

    const videoFile = {
      ...imageFile,
      mimetype: 'video/mp4',
      originalname: 'video.mp4',
      size: 1024 * 1024,
      buffer: Buffer.from('fake-video'),
    };

    const result = await service.uploadPostVideo(userId, videoFile, {});

    expect(storageProvider.uploadVideo).toHaveBeenCalledWith({
      userId,
      file: videoFile,
      maxDurationSeconds: 60,
    });
    expect(result).toEqual({
      url: 'https://cdn.example.com/uploads/posts/video.mp4',
      publicId: 'uploads/posts/video',
      durationSeconds: 59.4,
      moderation: {
        original_label: 'neutral',
        mapped_category: 'safe',
        confidence: 0.98,
        media_type: 'video',
        action: 'allow',
        can_open: true,
        should_blur: false,
        reason: 'Allowed image category.',
      },
    });
  });

  it('truncates long upload original names to fit persisted metadata columns', async () => {
    storageProvider.uploadVideo.mockResolvedValue({
      secureUrl: 'https://cdn.example.com/uploads/posts/video.mp4',
      publicId: 'uploads/posts/video',
      durationSeconds: 42,
    });
    prisma.upload.create.mockResolvedValue({
      id: 'upload-id',
      secureUrl: 'https://cdn.example.com/uploads/posts/video.mp4',
      publicId: 'uploads/posts/video',
      mimeType: 'video/mp4',
    });

    const longOriginalName = `${'a'.repeat(300)}.mp4`;
    const videoFile = {
      ...imageFile,
      mimetype: 'video/mp4',
      originalname: longOriginalName,
      size: 1024 * 1024,
      buffer: Buffer.from('fake-video'),
    };

    await service.uploadPostVideo(userId, videoFile, {});

    expect(prisma.upload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalName: longOriginalName.slice(0, 255),
      }),
      select: {
        id: true,
        secureUrl: true,
        publicId: true,
        mimeType: true,
      },
    });
  });

  it('attaches matching uploads and orphans removed resource uploads', async () => {
    const now = new Date('2026-05-10T09:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation(() => now);
    prisma.upload.updateMany.mockResolvedValue({ count: 1 });

    await service.syncAttachedUploads({
      ownerId: userId,
      secureUrls: [
        ' https://cdn.example.com/uploads/posts/one.jpg ',
        'https://cdn.example.com/uploads/posts/one.jpg',
      ],
      expectedType: 'post',
      attachedToType: 'post',
      attachedToId: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
    });

    expect(prisma.upload.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        ownerId: userId,
        type: 'post',
        secureUrl: {
          in: ['https://cdn.example.com/uploads/posts/one.jpg'],
        },
        deletedAt: null,
      },
      data: {
        status: 'attached',
        attachedToType: 'post',
        attachedToId: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
        attachedAt: now,
        orphanedAt: null,
      },
    });
    expect(prisma.upload.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        ownerId: userId,
        type: 'post',
        attachedToType: 'post',
        attachedToId: '9e5c7e4b-76b7-4e35-9bd1-df7a22c908d1',
        status: 'attached',
        deletedAt: null,
        secureUrl: {
          notIn: ['https://cdn.example.com/uploads/posts/one.jpg'],
        },
      },
      data: {
        status: 'orphaned',
        orphanedAt: now,
      },
    });

    jest.restoreAllMocks();
  });

  it('orphans all resource uploads when syncing an empty media list', async () => {
    prisma.upload.updateMany.mockResolvedValue({ count: 1 });

    await service.syncAttachedUploads({
      ownerId: userId,
      secureUrls: [],
      expectedType: 'reply',
      attachedToType: 'reply',
      attachedToId: '6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32',
    });

    expect(prisma.upload.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.upload.updateMany).toHaveBeenCalledWith({
      where: {
        ownerId: userId,
        type: 'reply',
        attachedToType: 'reply',
        attachedToId: '6d8d2f4f-23aa-41a5-9120-00d0a9ff8b32',
        status: 'attached',
        deletedAt: null,
      },
      data: {
        status: 'orphaned',
        orphanedAt: expect.any(Date),
      },
    });
  });

  it('marks old pending uploads as orphaned for cleanup', async () => {
    const olderThan = new Date('2026-05-09T09:00:00.000Z');
    prisma.upload.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.markOldPendingUploadsOrphaned({ ownerId: userId, olderThan });

    expect(result).toEqual({ count: 2 });
    expect(prisma.upload.updateMany).toHaveBeenCalledWith({
      where: {
        ownerId: userId,
        status: 'pending',
        deletedAt: null,
        createdAt: {
          lt: olderThan,
        },
      },
      data: {
        status: 'orphaned',
        orphanedAt: expect.any(Date),
      },
    });
  });
});
