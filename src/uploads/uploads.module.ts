import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IMAGE_STORAGE_PROVIDER } from './providers/image-storage.provider';
import { LocalImageStorageProvider } from './providers/local-image-storage.provider';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    {
      provide: IMAGE_STORAGE_PROVIDER,
      useClass: LocalImageStorageProvider,
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
