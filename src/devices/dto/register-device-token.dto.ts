import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceTokenManualDto {
  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'FCM token is required.' })
  @MinLength(1, { message: 'FCM token is required.' })
  @MaxLength(4096, { message: 'FCM token is too long.' })
  token!: string;

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'Invalid device platform.' })
  @IsIn(['ios', 'android', 'web'], { message: 'Invalid device platform.' })
  platform!: 'ios' | 'android' | 'web';

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsOptional()
  @IsUUID('4', { message: 'Invalid user id.' })
  userId?: string;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
