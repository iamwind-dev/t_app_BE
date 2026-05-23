import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReelCommentDto {
  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsString()
  @MinLength(1, { message: 'Comment must not be empty.' })
  @MaxLength(500, { message: 'Comment must be at most 500 characters.' })
  content!: string;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
