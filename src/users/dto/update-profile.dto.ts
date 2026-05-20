import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^(?!\.)(?!.*\.$)[A-Za-z0-9_.]+$/, {
    message: 'Username format is invalid.',
  })
  username?: string;

  @Transform(({ value }) => trimStringInput(value as unknown))
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Display name cannot be empty.' })
  @MaxLength(80)
  displayName?: string;

  @Transform(({ value }) => trimNullableStringInput(value as unknown))
  @ValidateIf((_object, value: unknown) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(160, { message: 'Bio is too long.' })
  bio?: string | null;

  @Transform(({ value }) => trimNullableStringInput(value as unknown))
  @ValidateIf((_object, value: unknown) => value !== null && value !== undefined)
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'Avatar URL must be valid.' })
  @MaxLength(2048)
  avatarUrl?: string | null;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimNullableStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
