import { Transform } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class SyncEventsQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Invalid sinceEventId.' })
  sinceEventId?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'sinceOccurredAt must be a valid ISO datetime.' })
  sinceOccurredAt?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'limit must be an integer.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(200, { message: 'limit must be at most 200.' })
  limit?: number;

  @IsOptional()
  @IsString({ message: 'rooms must be a comma-separated string.' })
  rooms?: string;
}
