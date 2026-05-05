import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { MasterColor } from '../task-status.entity';
import { MASTER_COLORS } from './master-color';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(MASTER_COLORS)
  color!: MasterColor;
}
