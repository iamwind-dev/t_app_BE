import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class CreateReelDto {
  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'Video URL must be valid.' })
  videoUrl!: string;

  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Caption must be at most 500 characters.' })
  caption?: string;

  @Transform(({ value }) => emptyStringToUndefined(value as unknown))
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'Thumbnail URL must be valid.' })
  thumbnailUrl?: string;

  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Audio title must be at most 120 characters.' })
  audioTitle?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'Duration must be between 1 and 60 seconds.' })
  @Min(1, { message: 'Duration must be between 1 and 60 seconds.' })
  @Max(60, { message: 'Duration must be between 1 and 60 seconds.' })
  durationSeconds?: number;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
