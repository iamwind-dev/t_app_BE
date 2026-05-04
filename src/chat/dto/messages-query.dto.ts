import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class MessagesQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Pagination cursor is invalid.' })
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'Limit must be between 1 and 100.' })
  @Min(1, { message: 'Limit must be between 1 and 100.' })
  @Max(100, { message: 'Limit must be between 1 and 100.' })
  limit?: number = 30;
}
