import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tenantKey!: string;

  @IsEmail()
  @MaxLength(254) // RFC 5321
  email!: string;

  /**
   * パスワード。
   * - 上限 72: bcrypt は 72 byte 超を黙って切り詰めるので、それ以前で reject する。
   *   ※ class-validator の MaxLength は文字数ベースなので、マルチバイト文字を含む
   *   場合は更にバイト数が大きくなるが、保守的に 72 文字で制限。
   * - 上限を設けることで長大な文字列による hash DoS も防止。
   */
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
