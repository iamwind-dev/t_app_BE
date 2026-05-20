import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { UploadImageDto } from './dto/upload-image.dto';
import { UploadVideoDto } from './dto/upload-video.dto';
import { UploadsService } from './uploads.service';
import { UploadImageResponse, UploadVideoResponse } from './types/upload-response.type';

const maxImageSizeBytes = 5 * 1024 * 1024;
const maxVideoSizeBytes = 25 * 1024 * 1024;

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        type: {
          type: 'string',
          enum: ['post', 'reply', 'profile_avatar'],
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Image uploaded successfully.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: maxImageSizeBytes,
        files: 1,
      },
      fileFilter: (_request: Request, file: Express.Multer.File, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          callback(
            new BadRequestException({
              code: 'UPLOAD_INVALID_MIME_TYPE',
              message: 'Only JPEG, PNG, and WebP images are allowed.',
            }),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadImage(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadImageDto,
  ): Promise<UploadImageResponse> {
    return this.uploadsService.uploadImage(currentUser.id, file, dto);
  }

  @Post('video')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Post video uploaded successfully.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: maxVideoSizeBytes,
        files: 1,
      },
      fileFilter: (_request: Request, file: Express.Multer.File, callback) => {
        if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype)) {
          callback(
            new BadRequestException({
              code: 'UPLOAD_INVALID_MIME_TYPE',
              message: 'Only MP4, MOV, and WEBM videos are allowed.',
            }),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadVideo(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadVideoDto,
  ): Promise<UploadVideoResponse> {
    return this.uploadsService.uploadPostVideo(currentUser.id, file, dto);
  }
}
