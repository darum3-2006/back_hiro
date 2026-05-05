import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { MasterColor } from '../task-status.entity';
import { MASTER_COLORS } from './master-color';

export class UpdateTaskPriorityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsIn(MASTER_COLORS)
  color?: MasterColor;
}
