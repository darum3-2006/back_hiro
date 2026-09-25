import { apiListDueTasks } from '~/api/dashboard';
import type { DashboardDateField } from '~/types/user-settings';

/**
 * ダッシュボード用：期限切れ / 期限間近のタスク（プロジェクト横断・閲覧できる全タスク）。
 * 設定を変えたら取り直す（基準日付が変わると対象そのものが変わるため）。
 */
export const useDueTasks = (params: {
  dateField: Ref<DashboardDateField>;
  dueSoonDays: Ref<number>;
}) => {
  const api = useApi();
  return useAsyncData(
    'dashboard-due',
    () =>
      apiListDueTasks(api, {
        dateField: params.dateField.value,
        dueSoonDays: params.dueSoonDays.value,
      }),
    {
      default: () => ({ overdue: [], dueSoon: [] }),
      watch: [params.dateField, params.dueSoonDays],
    },
  );
};
