import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { SAVED_VIEW_VISIBILITIES, type SavedViewVisibility } from '../saved-view.entity';
import { SavedViewConfigDto } from './create-saved-view.dto';

export class UpdateSavedViewDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(SAVED_VIEW_VISIBILITIES)
  visibility?: SavedViewVisibility;

  @IsOptional()
  @ValidateNested()
  @Type(() => SavedViewConfigDto)
  config?: SavedViewConfigDto;
}
