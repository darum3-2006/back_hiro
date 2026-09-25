import type { DashboardTask, DueTasks } from '~/types/dashboard';
import type { DashboardDateField } from '~/types/user-settings';

/**
 * GET /api/me/dashboard/due — 期限切れ / 期限間近のタスク（プロジェクト横断）。
 * 引数を省略するとユーザー設定の値が使われる。
 */
export const apiListDueTasks = (
  api: typeof $fetch,
  params: { dateField?: DashboardDateField; dueSoonDays?: number } = {},
): Promise<DueTasks> => api<DueTasks>('/me/dashboard/due', { query: params });

/**
 * GET /api/me/dashboard/inactive — ステータスが一定日数変わっていないタスク（プロジェクト横断）。
 * 引数を省略するとユーザー設定の値が使われる。
 */
export const apiListInactiveTasks = (
  api: typeof $fetch,
  params: { inactiveDays?: number } = {},
): Promise<DashboardTask[]> => api<DashboardTask[]>('/me/dashboard/inactive', { query: params });
