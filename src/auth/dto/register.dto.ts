import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => normalizeEmailInput(value as unknown))
  @IsEmail({}, { message: 'Email must be valid.' })
  @MaxLength(255)
  email!: string;

  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^(?!\.)(?!.*\.$)[A-Za-z0-9_.]+$/, {
    message: 'Username format is invalid.',
  })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password does not meet requirements.',
  })
  password!: string;

  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmailInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
