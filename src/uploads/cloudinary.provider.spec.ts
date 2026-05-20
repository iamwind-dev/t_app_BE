import { ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryProvider } from './cloudinary.provider';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('CloudinaryProvider', () => {
  const uploadStreamEnd = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    uploadStreamEnd.mockReset();
  });

  it('uploads an image buffer through Cloudinary upload_stream', async () => {
    const uploadStream = {
      end: uploadStreamEnd,
    };

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (
        _options: unknown,
        callback: (
          error: { message: string } | undefined,
          result:
            | {
                secure_url: string;
                public_id: string;
              }
            | undefined,
        ) => void,
      ) => {
        uploadStreamEnd.mockImplementation(() =>
          callback(undefined, {
            secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/threads-like/posts/user/image',
            public_id: 'threads-like/posts/user/image',
          }),
        );

        return uploadStream;
      },
    );

    const provider = new CloudinaryProvider({
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          CLOUDINARY_CLOUD_NAME: 'demo',
          CLOUDINARY_API_KEY: 'api-key',
          CLOUDINARY_API_SECRET: 'api-secret',
          CLOUDINARY_UPLOAD_FOLDER: 'threads-like',
        };

        return values[key] ?? fallback;
      }),
    } as never);

    const result = await provider.uploadImage({
      userId: 'user-id',
      type: 'post',
      file: {
        buffer: Buffer.from('image'),
      } as Express.Multer.File,
    });

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'demo',
      api_key: 'api-key',
      api_secret: 'api-secret',
      secure: true,
    });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
    expect(uploadStreamEnd).toHaveBeenCalledWith(Buffer.from('image'));
    expect(result).toEqual({
      secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/threads-like/posts/user/image',
      publicId: 'threads-like/posts/user/image',
    });
  });

  it('fails with a clear error when Cloudinary credentials are missing', async () => {
    const provider = new CloudinaryProvider({
      get: jest.fn((_key: string, fallback?: string) => fallback),
    } as never);

    await expect(
      provider.uploadImage({
        userId: 'user-id',
        type: 'post',
        file: {
          buffer: Buffer.from('image'),
        } as Express.Multer.File,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('uploads post video and returns duration when <= maxDurationSeconds', async () => {
    const uploadStream = {
      end: uploadStreamEnd,
    };

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (
        _options: unknown,
        callback: (
          error: { message: string } | undefined,
          result:
            | {
                secure_url: string;
                public_id: string;
                duration: number;
              }
            | undefined,
        ) => void,
      ) => {
        uploadStreamEnd.mockImplementation(() =>
          callback(undefined, {
            secure_url: 'https://res.cloudinary.com/demo/video/upload/v1/threads-like/posts/user/video',
            public_id: 'threads-like/posts/user/video',
            duration: 8.2,
          }),
        );
        return uploadStream;
      },
    );

    const provider = new CloudinaryProvider({
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          CLOUDINARY_CLOUD_NAME: 'demo',
          CLOUDINARY_API_KEY: 'api-key',
          CLOUDINARY_API_SECRET: 'api-secret',
          CLOUDINARY_UPLOAD_FOLDER: 'threads-like',
        };
        return values[key] ?? fallback;
      }),
    } as never);

    const result = await provider.uploadVideo({
      userId: 'user-id',
      maxDurationSeconds: 10,
      file: { buffer: Buffer.from('video') } as Express.Multer.File,
    });

    expect(result.durationSeconds).toBe(8.2);
    expect(result.publicId).toBe('threads-like/posts/user/video');
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
