import { IsArray, IsString, Matches } from 'class-validator';

const roomPattern = /^(feed:global|user:[0-9a-fA-F-]{36}|thread:[0-9a-fA-F-]{36}|chat:[0-9a-fA-F-]{36})$/;

export class RealtimeRoomsDto {
  @IsArray({ message: 'rooms must be an array.' })
  @IsString({ each: true, message: 'Each room must be a string.' })
  @Matches(roomPattern, {
    each: true,
    message:
      'room must be one of feed:global, user:{uuid}, thread:{uuid}, or chat:{uuid}.',
  })
  rooms!: string[];
}
