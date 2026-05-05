import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;

  /** 紐づく User の id。null = フリー入力メンバー */
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}
