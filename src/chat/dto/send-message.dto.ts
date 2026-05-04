import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientMessageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientTempId?: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;
}
