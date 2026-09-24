/**
 * ユーザーごとの画面設定。端末をまたいで引き継ぐため localStorage ではなくサーバに置く。
 *
 * 画面ごとに名前空間を切る。設定が増えても互いに衝突せず、
 * 部分更新（PATCH）で他画面の設定を巻き込まない。
 */
export interface UserSettings {
  dashboard?: DashboardSettings;
}

/** 期限判定の基準にできる日付フィールド。過去の記録（作成日時等）は基準にならないので含めない */
export const DASHBOARD_DATE_FIELDS = [
  'deadline',
  'plannedStart',
  'plannedCompletion',
  'plannedRelease',
] as const;

export type DashboardDateField = (typeof DASHBOARD_DATE_FIELDS)[number];

export interface DashboardSettings {
  /** 期限切れ / 期限間近の判定に使う日付フィールド */
  dateField: DashboardDateField;
  /** 期限間近とみなす日数（1〜30） */
  dueSoonDays: number;
  /** ステータスがこの日数以上変わっていなければ「動きなし」とみなす（1〜90） */
  inactiveDays: number;
}

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  dateField: 'deadline',
  dueSoonDays: 7,
  inactiveDays: 7,
};

/** 読み出し時の形。未設定の画面にも既定値が入っているので optional でない */
export interface ResolvedUserSettings {
  dashboard: DashboardSettings;
}
