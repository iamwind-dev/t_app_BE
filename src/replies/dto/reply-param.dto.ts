import { IsUUID } from 'class-validator';

export class ReplyIdParamDto {
  @IsUUID('4', { message: 'Reply id must be a valid UUID.' })
  replyId!: string;
}

export class PostReplyParamDto {
  @IsUUID('4', { message: 'Post id must be a valid UUID.' })
  postId!: string;
}
