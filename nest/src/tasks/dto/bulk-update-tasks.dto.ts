import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * 一括編集。ids の各タスクへ、指定されたフィールドのみ適用する。
 * - スカラー（statusCode / assigneeMemberId / priorityCode / 各日付）は置換（未指定＝変更なし）
 * - タグ / フラグは add / remove で差分適用（各タスクの現在値に対して）
 */
export class BulkUpdateTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  statusCode?: string;

  @IsOptional()
  @IsUUID()
  assigneeMemberId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  priorityCode?: string | null;

  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string | null;

  @IsOptional()
  @IsDateString()
  plannedCompletionDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  addTagCodes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  removeTagCodes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  addFlagCodes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  removeFlagCodes?: string[];
}
