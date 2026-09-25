import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { DASHBOARD_DATE_FIELDS, type DashboardDateField } from '../user-settings';

export class DashboardSettingsDto {
  /** 期限切れ / 期限間近の判定に使う日付フィールド */
  @IsOptional()
  @IsIn(DASHBOARD_DATE_FIELDS)
  dateField?: DashboardDateField;

  /** 期限間近とみなす日数。上限を設けないと実質フィルタなしになるので 30 日で頭打ち */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  dueSoonDays?: number;

  /** 動きなしとみなす日数。四半期（90 日）を超える放置はそれ以上区別しても意味が薄い */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  inactiveDays?: number;
}

export class UpdateUserSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardSettingsDto)
  dashboard?: DashboardSettingsDto;
}
