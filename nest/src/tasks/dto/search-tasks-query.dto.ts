import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * グローバル検索（プロジェクト横断）のクエリ。画面の GET /search/tasks と
 * 公開API の GET /v1/tasks/search で共有し、既定値と範囲をここ 1 か所で決める。
 */
export class SearchTasksQueryDto {
  /** 検索キーワード。空（未指定・空白のみ）なら結果は空配列 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q: string = '';

  /** 最大件数（1〜50） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
