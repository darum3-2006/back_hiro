/** 期限判定の基準にできる日付フィールド。過去の記録（作成日時等）は基準にならないので含めない */
export const DASHBOARD_DATE_FIELDS = [
  'deadline',
  'plannedStart',
  'plannedCompletion',
  'plannedRelease',
] as const;

export type DashboardDateField = (typeof DASHBOARD_DATE_FIELDS)[number];

/** 基準日付の表示名。タスク一覧のフィルタと同じ語を使う */
export const DASHBOARD_DATE_FIELD_LABELS: Record<DashboardDateField, string> = {
  deadline: '期限',
  plannedStart: '着手予定日',
  plannedCompletion: '完了予定日',
  plannedRelease: 'リリース予定日',
};

export interface DashboardSettings {
  /** 期限切れ / 期限間近の判定に使う日付フィールド */
  dateField: DashboardDateField;
  /** 期限間近とみなす日数（1〜30） */
  dueSoonDays: number;
}

/** 読み出し時の形。未設定の画面にも既定値が入っているので optional でない */
export interface UserSettings {
  dashboard: DashboardSettings;
}

export type UpdateUserSettingsInput = {
  dashboard?: Partial<DashboardSettings>;
};
