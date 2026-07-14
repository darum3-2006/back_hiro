import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TaskLinkDto } from '../../tasks/dto/task-link.dto';

/**
 * 公開API: タスク作成の入力。
 * ステータスは受けず、サーバがステータスマスタの先頭（order 最小）を自動セットする。
 * 担当者も受けない（POST /tasks/{seq}/member で割り当てる）。
 */
export class PublicCreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  /** 関連リンク。送られた配列で全置換する */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaskLinkDto)
  links?: TaskLinkDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  priorityCode?: string | null;

  @IsOptional()
  @IsUUID()
  requesterMemberId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestingDeptCode?: string | null;

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
  @IsDateString()
  plannedReleaseDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  tagCodes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  flagCodes?: string[];
}

/**
 * 公開API: タスク更新の入力（部分更新）。
 * ステータス・担当者は対象外（それぞれ POST /status・POST /member を使う）。
 * links / tagCodes / flagCodes は送られた配列で全置換する。
 */
export class PublicUpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaskLinkDto)
  links?: TaskLinkDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  priorityCode?: string | null;

  @IsOptional()
  @IsUUID()
  requesterMemberId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestingDeptCode?: string | null;

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
  @IsDateString()
  plannedReleaseDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  tagCodes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  flagCodes?: string[];
}

/** 公開API: ステータス変更の入力。 */
export class PublicSetTaskStatusDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  statusCode!: string;
}

/** 公開API: 担当者割り当ての入力。null または省略で担当なしに戻す。 */
export class PublicSetTaskMemberDto {
  @IsOptional()
  @IsUUID()
  memberId?: string | null;
}
