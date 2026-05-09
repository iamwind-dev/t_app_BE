import { BadGatewayException, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { IMAGE_STORAGE_PROVIDER } from './providers/image-storage.provider';
import type { ImageStorageProvider } from './providers/image-storage.provider';
import { PrismaService } from '../prisma/prisma.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let storageProvider: ImageStorageProvider & {
    uploadImage: jest.Mock;
  };
  let prisma: {
    upload: {
      create: jest.Mock;
    };
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
    };
    prisma = {
      upload: {
        create: jest.fn(),
      },
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
    });

    const result = await service.uploadImage(userId, imageFile, { type: ' post ' });

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
      },
    });
    expect(result).toEqual({
      upload: {
        id: 'upload-id',
        secureUrl: 'https://cdn.example.com/uploads/posts/public-id.jpg',
        publicId: 'uploads/posts/public-id',
        type: 'post',
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
    await expect(service.uploadImage(userId, imageFile, { type: 'cover' })).rejects.toThrow(
      BadRequestException,
    );
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
});
