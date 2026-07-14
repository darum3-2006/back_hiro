import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 公開API: プロジェクト作成の入力。 */
export class PublicCreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

/**
 * 公開API: プロジェクト更新の入力。
 * 部分更新（PATCH）。公開APIから書けるのは name / description のみ
 * （表示設定や Slack 設定は対象外）。
 */
export class PublicUpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
