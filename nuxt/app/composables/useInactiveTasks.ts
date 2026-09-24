import { apiListInactiveTasks } from '~/api/dashboard';

/**
 * ダッシュボード用：ステータスが一定日数変わっていないタスク（プロジェクト横断・閲覧できる全タスク）。
 * 日数を変えたら取り直す。
 */
export const useInactiveTasks = (params: { inactiveDays: Ref<number> }) => {
  const api = useApi();
  return useAsyncData(
    'dashboard-inactive',
    () => apiListInactiveTasks(api, { inactiveDays: params.inactiveDays.value }),
    { default: () => [], watch: [params.inactiveDays] },
  );
};
