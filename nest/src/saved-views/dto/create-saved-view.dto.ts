import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SAVED_VIEW_VISIBILITIES, type SavedViewVisibility } from '../saved-view.entity';

class SavedViewColumnsDto {
  @IsArray()
  @IsString({ each: true })
  order!: string[];

  @IsObject()
  visibility!: Record<string, boolean>;

  @IsObject()
  sizing!: Record<string, number>;
}

class SavedViewSortDto {
  @IsString()
  columnId!: string;

  @IsIn(['asc', 'desc'])
  dir!: 'asc' | 'desc';
}

export class SavedViewConfigDto {
  @ValidateNested()
  @Type(() => SavedViewColumnsDto)
  columns!: SavedViewColumnsDto;

  @IsObject()
  filters!: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => SavedViewSortDto)
  sort!: SavedViewSortDto | null;
}

export class CreateSavedViewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsIn(SAVED_VIEW_VISIBILITIES)
  visibility?: SavedViewVisibility;

  @ValidateNested()
  @Type(() => SavedViewConfigDto)
  config!: SavedViewConfigDto;
}
