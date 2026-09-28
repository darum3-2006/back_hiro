import type { MyTask } from '~/types/task';

/** 期限系ダッシュボードの 1 件。基準日付は設定で切り替わるので targetDate に正規化されている */
export interface DashboardTask extends MyTask {
  /** 判定に使った基準日付の値（YYYY-MM-DD） */
  targetDate: string;
  /** 担当メンバーの表示名。未割り当てなら null */
  assigneeName: string | null;
}

export interface DueTasks {
  overdue: DashboardTask[];
  dueSoon: DashboardTask[];
}
