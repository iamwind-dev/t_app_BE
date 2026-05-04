import { IsUUID } from 'class-validator';

export class NotificationIdParamDto {
  @IsUUID('4', { message: 'Invalid notification id.' })
  id!: string;
}
