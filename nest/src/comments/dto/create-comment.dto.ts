import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  authorMemberId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50_000)
  body!: string;
}
