import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(['admin', 'power_user', 'member', 'readonly'])
  role?: 'admin' | 'power_user' | 'member' | 'readonly';

  /** 指定があればパスワードリセット */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;
}
