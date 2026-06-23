import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';

export class BulkCreateMembersDto {
  /** 表示名（1 行 1 件）。User 紐付けは全て無し。空行はサーバ側で除外する。 */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  displayNames!: string[];

  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}
