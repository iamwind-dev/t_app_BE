import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreatePostDto {
  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Content must be at most 500 characters.' })
  content?: string;

  @IsOptional()
  @IsArray({ message: 'mediaUrls must be an array.' })
  @ArrayMaxSize(10, { message: 'A post can include at most 10 media items.' })
  @IsUrl({ require_tld: false }, { each: true, message: 'Each media URL must be valid.' })
  mediaUrls?: string[];
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
