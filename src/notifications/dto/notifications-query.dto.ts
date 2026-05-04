import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class NotificationsQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Invalid cursor.' })
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'Invalid pagination limit.' })
  @Min(1, { message: 'Invalid pagination limit.' })
  @Max(50, { message: 'Invalid pagination limit.' })
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseBooleanInput(value))
  @IsBoolean({ message: 'Invalid unreadOnly value.' })
  unreadOnly?: boolean;
}

function parseBooleanInput(value: unknown): unknown {
  if (value === undefined || typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}
