import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import type { ImageStorageProvider } from './image-storage.provider';
import type { ImageUploadRequest, StoredImage } from '../types/upload-response.type';

const uploadFolderByType = {
  post: 'posts',
  reply: 'replies',
  profile_avatar: 'avatars',
};

@Injectable()
export class LocalImageStorageProvider implements ImageStorageProvider {
  constructor(private readonly configService: ConfigService) {}

  async uploadImage(input: ImageUploadRequest): Promise<StoredImage> {
    const rootDirectory = this.configService.get<string>('UPLOAD_LOCAL_DIR', 'uploads');
    const publicBaseUrl = this.configService.get<string>(
      'UPLOAD_PUBLIC_BASE_URL',
      'https://localhost:3000/uploads',
    );
    const folder = uploadFolderByType[input.type];
    const extension = this.getSafeExtension(input.file);
    const fileName = `${randomUUID()}${extension}`;
    const publicId = `uploads/${folder}/${fileName.replace(extension, '')}`;
    const targetDirectory = join(process.cwd(), rootDirectory, folder);
    const targetPath = join(targetDirectory, fileName);

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(targetPath, input.file.buffer);

    return {
      secureUrl: `${publicBaseUrl.replace(/\/$/, '')}/${folder}/${fileName}`,
      publicId,
    };
  }

  private getSafeExtension(file: Express.Multer.File): string {
    const extension = extname(file.originalname).toLowerCase();

    if (extension) {
      return extension;
    }

    if (file.mimetype === 'image/png') {
      return '.png';
    }

    if (file.mimetype === 'image/webp') {
      return '.webp';
    }

    return '.jpg';
  }
}
