import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateReplyDto {
  @Transform(({ value }) => trimNullableStringInput(value as unknown))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Content must be at most 500 characters.' })
  content?: string | null;

  @IsOptional()
  @IsArray({ message: 'mediaUrls must be an array.' })
  @ArrayMaxSize(10, { message: 'A reply can include at most 10 media items.' })
  @IsUrl({}, { each: true, message: 'Each media URL must be valid.' })
  mediaUrls?: string[];
}

function trimNullableStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
