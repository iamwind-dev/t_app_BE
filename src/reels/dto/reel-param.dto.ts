import { IsUUID } from 'class-validator';

export class ReelIdParamDto {
  @IsUUID('4', { message: 'Reel id must be a valid UUID.' })
  id!: string;
}
