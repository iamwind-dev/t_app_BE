import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModerationModule } from '../modules/moderation/moderation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryProvider } from './cloudinary.provider';
import { IMAGE_STORAGE_PROVIDER } from './providers/image-storage.provider';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [ConfigModule, PrismaModule, ModerationModule],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    {
      provide: IMAGE_STORAGE_PROVIDER,
      useClass: CloudinaryProvider,
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
