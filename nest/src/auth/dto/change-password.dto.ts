import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /** 現在のパスワード（本人確認用）。 */
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword!: string;

  /**
   * 新しいパスワード。
   * - 8〜72 文字（bcrypt の 72 byte 制約 / hash DoS 対策で上限あり）。
   */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
