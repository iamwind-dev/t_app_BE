import { IsUUID } from 'class-validator';

export class DirectConversationParamDto {
  @IsUUID('4', { message: 'Invalid user id.' })
  userId!: string;
}

export class ConversationIdParamDto {
  @IsUUID('4', { message: 'Invalid conversation id.' })
  id!: string;
}
