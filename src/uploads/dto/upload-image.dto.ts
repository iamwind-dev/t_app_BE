import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';
import type { UploadImageType } from '../types/upload-response.type';

export class UploadImageDto {
  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'Upload type is required.' })
  @IsIn(['post', 'reply', 'profile_avatar'], { message: 'Upload type is invalid.' })
  type!: UploadImageType;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
