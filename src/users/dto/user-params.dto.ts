import { Transform } from 'class-transformer';
import { IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class UserIdParamDto {
  @IsUUID('4', { message: 'Invalid user id.' })
  id!: string;
}

export class UsernameParamDto {
  @Transform(({ value }) => trimStringInput(value as unknown))
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^(?!\.)(?!.*\.$)[A-Za-z0-9_.]+$/, {
    message: 'Username format is invalid.',
  })
  username!: string;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
