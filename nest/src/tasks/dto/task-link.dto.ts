import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class TaskLinkDto {
  @IsString()
  @MaxLength(255)
  label!: string;

  @IsUrl()
  @MinLength(1)
  @MaxLength(2000)
  url!: string;
}
