import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class MoveTaskDto {
  @IsUUID()
  targetProjectId!: string;

  /** 移動先のステータス（必須） */
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  statusCode!: string;

  /** 移動先の優先度。null で「なし」 */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(64)
  priorityCode?: string | null;

  /** 移動先の担当者メンバー。null で「なし」 */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assigneeMemberId?: string | null;

  /** 移動先の依頼者メンバー。null で「なし」 */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  requesterMemberId?: string | null;
}
