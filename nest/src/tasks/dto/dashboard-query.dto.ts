import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DASHBOARD_DATE_FIELDS, type DashboardDateField } from '../../users/user-settings';

export class DashboardQueryDto {
  /** 省略時はユーザー設定の値を使う */
  @IsOptional()
  @IsIn(DASHBOARD_DATE_FIELDS)
  dateField?: DashboardDateField;

  /** 省略時はユーザー設定の値を使う */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  dueSoonDays?: number;

  /** 省略時はユーザー設定の値を使う */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  inactiveDays?: number;
}
