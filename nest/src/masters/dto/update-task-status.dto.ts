import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { MasterColor } from '../task-status.entity';
import { MASTER_COLORS } from './master-color';

export class UpdateTaskStatusDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsIn(MASTER_COLORS)
  color?: MasterColor;

  @IsOptional()
  @IsBoolean()
  isTerminal?: boolean;

  /** 初期状態（未着手扱い）。停滞集計の対象外にするために使う */
  @IsOptional()
  @IsBoolean()
  isInitial?: boolean;
}
