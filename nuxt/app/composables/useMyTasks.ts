import { apiListMyTasks } from '~/api/tasks';

/** ホームダッシュボード用：自分が担当の未完了タスク（テナント横断）。 */
export const useMyTasks = () => {
  const api = useApi();
  return useAsyncData('my-tasks', () => apiListMyTasks(api), { default: () => [] });
};
