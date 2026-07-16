import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

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
}
