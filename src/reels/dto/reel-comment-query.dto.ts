import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ReelCommentQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'Limit must be between 1 and 50.' })
  @Min(1, { message: 'Limit must be between 1 and 50.' })
  @Max(50, { message: 'Limit must be between 1 and 50.' })
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsUUID('4', { message: 'Pagination cursor is invalid.' })
  cursor?: string;
}
