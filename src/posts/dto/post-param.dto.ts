import { IsUUID } from 'class-validator';

export class PostIdParamDto {
  @IsUUID('4', { message: 'Post id must be a valid UUID.' })
  id!: string;
}
