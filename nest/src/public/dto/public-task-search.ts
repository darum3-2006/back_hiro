import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * 公開API: GET /v1/tasks/search のクエリ。
 * 検索の挙動は画面のグローバル検索（GET /search/tasks）と同じ。
 */
export class PublicTaskSearchQueryDto {
  /** 検索キーワード。空（未指定・空白のみ）なら結果は空配列 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  /** 最大件数（1〜50、既定 20） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
