import { Transform } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class TestPushTokenDto {
  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'FCM token is required.' })
  @MinLength(1, { message: 'FCM token is required.' })
  @MaxLength(4096, { message: 'FCM token is too long.' })
  token!: string;

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'Notification title is required.' })
  @MinLength(1, { message: 'Notification title is required.' })
  @MaxLength(200, { message: 'Notification title is too long.' })
  title!: string;

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'Notification body is required.' })
  @MinLength(1, { message: 'Notification body is required.' })
  @MaxLength(500, { message: 'Notification body is too long.' })
  body!: string;

  @IsOptional()
  @IsObject({ message: 'Notification data must be an object.' })
  @ValidateIf(({ data }: TestPushTokenDto) => data !== null)
  data?: Record<string, string | number | boolean>;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
