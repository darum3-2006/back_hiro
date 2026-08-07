import {
  ArrayUnique,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsIn(['admin', 'power_user', 'member', 'readonly'])
  role!: 'admin' | 'power_user' | 'member' | 'readonly';

  /**
   * 閲覧を許可するプロジェクト。省略時は 0 件（明示付与運用）。
   * admin はこの設定に関係なく全プロジェクトを閲覧できる。
   */
  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
