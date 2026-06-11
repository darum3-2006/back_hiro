import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * GET /tasks のクエリパラメータ。当面はサーバ側絞り込みを実装しないが、
 * 将来 B（サーバフィルタ + ページネーション）に拡張する余地を残す。
 */
export class TaskFilterDto {
  /**
   * 完了（終端ステータス）タスクを含めるか。一覧(listByProject)でのみ参照し、
   * 未指定/false なら完了タスクを除外する。クエリ文字列なので 'true'/'1' を真とする。
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeCompleted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  statusCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  priorityCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tagCode?: string;

  @IsOptional()
  @IsUUID()
  assigneeMemberId?: string;

  @IsOptional()
  @IsUUID()
  requesterMemberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestingDeptCode?: string;
}
