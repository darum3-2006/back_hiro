import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * GET /tasks のクエリパラメータ。当面はサーバ側絞り込みを実装しないが、
 * 将来 B（サーバフィルタ + ページネーション）に拡張する余地を残す。
 */
export class TaskFilterDto {
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
