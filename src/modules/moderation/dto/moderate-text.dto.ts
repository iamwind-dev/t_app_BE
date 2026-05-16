import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ModerateTextDto {
  @Transform(({ value }: { value: unknown }) => trimStringInput(value))
  @IsString({ message: 'Text is required.' })
  @MinLength(1, { message: 'Text is required.' })
  @MaxLength(5000, { message: 'Text is too long.' })
  text!: string;
}

function trimStringInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
