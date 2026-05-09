import { IsUUID } from 'class-validator';

export class MarkSeenBodyDto {
  @IsUUID('4', { message: 'Invalid message id.' })
  messageId!: string;
}

