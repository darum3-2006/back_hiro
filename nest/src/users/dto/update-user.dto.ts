import {
  ArrayUnique,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(['admin', 'power_user', 'member', 'readonly'])
  role?: 'admin' | 'power_user' | 'member' | 'readonly';

  /** 有効フラグ（false でログイン無効化。既存セッションも失効する） */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 指定があればパスワードリセット */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  /**
   * 閲覧を許可するプロジェクト（指定した内容で丸ごと置き換える）。
   * 省略時は変更しない。admin はこの設定に関係なく全プロジェクトを閲覧できる。
   */
  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
