import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSubtaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsUUID()
  assigneeMemberId?: string | null;

  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  memo?: string | null;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  /** フラグコード（全置換。タスクと同じ流儀） */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  flagCodes?: string[];
}
