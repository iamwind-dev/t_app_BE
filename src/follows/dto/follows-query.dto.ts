import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class FollowsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'Invalid pagination limit.' })
  @Min(1, { message: 'Invalid pagination limit.' })
  @Max(50, { message: 'Invalid pagination limit.' })
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsUUID('4', { message: 'Invalid cursor.' })
  cursor?: string;
}
