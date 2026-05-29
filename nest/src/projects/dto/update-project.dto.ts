import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  /** true = アーカイブ、false = 復元 */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsBoolean()
  highlightOverdueDeadline?: boolean;

  @IsOptional()
  @IsBoolean()
  highlightOverduePlannedCompletion?: boolean;

  @IsOptional()
  @IsBoolean()
  highlightOverduePlannedRelease?: boolean;
}
