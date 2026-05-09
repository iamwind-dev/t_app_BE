import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export type DevicePlatform = 'ios' | 'android' | 'web';

export class RegisterDeviceTokenDto {
  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'FCM token is required.' })
  @MinLength(1, { message: 'FCM token is required.' })
  @MaxLength(4096, { message: 'FCM token is too long.' })
  token!: string;

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'Invalid device platform.' })
  @IsIn(['ios', 'android', 'web'], { message: 'Invalid device platform.' })
  platform!: DevicePlatform;

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Device id is too long.' })
  deviceId?: string;

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'App version is too long.' })
  appVersion?: string;
}

export class RevokeDeviceTokenDto {
  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'FCM token is required.' })
  @MinLength(1, { message: 'FCM token is required.' })
  @MaxLength(4096, { message: 'FCM token is too long.' })
  token!: string;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

