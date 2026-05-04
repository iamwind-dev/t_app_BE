import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class JoinConversationPayloadDto {
  @IsUUID('4', { message: 'Invalid conversation id.' })
  conversationId!: string;
}

export class LeaveConversationPayloadDto extends JoinConversationPayloadDto {}

export class SendMessagePayloadDto {
  @IsUUID('4', { message: 'Invalid conversation id.' })
  conversationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientMessageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientTempId?: string;

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['text'])
  type?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Invalid media url.' })
  @MaxLength(2048)
  mediaUrl?: string;
}

export class TypingPayloadDto {
  @IsUUID('4', { message: 'Invalid conversation id.' })
  conversationId!: string;
}

export class MarkSeenPayloadDto {
  @IsUUID('4', { message: 'Invalid conversation id.' })
  conversationId!: string;

  @IsUUID('4', { message: 'Invalid message id.' })
  messageId!: string;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
