import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 公開API: コメント投稿の入力。
 * 投稿者は受けず、API キーの持ち主のプロジェクトメンバーを自動で投稿者にする。
 */
export class PublicCreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50_000)
  body!: string;
}
