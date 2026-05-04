import { IsUUID } from 'class-validator';

export class PostReactionParamDto {
  @IsUUID('4', { message: 'Post id must be a valid UUID.' })
  postId!: string;
}

export class ReplyReactionParamDto {
  @IsUUID('4', { message: 'Reply id must be a valid UUID.' })
  replyId!: string;
}
