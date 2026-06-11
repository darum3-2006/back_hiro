import { apiListTasks } from '~/api/tasks';

/**
 * プロジェクトのタスク一覧。既定では完了（終端ステータス）タスクを取得しない
 * （ペイロード削減）。includeCompleted が true のときだけ全件取得する。
 * キーに open/all を含めるので、トグル時に再フェッチされる。
 */
export const useTasks = (projectId: Ref<string>, includeCompleted: Ref<boolean>) => {
  const api = useApi();
  return useAsyncData(
    () => `tasks:${projectId.value}:${includeCompleted.value ? 'all' : 'open'}`,
    () =>
      apiListTasks(api, projectId.value, includeCompleted.value ? { includeCompleted: true } : {}),
    { default: () => [], watch: [projectId, includeCompleted] },
  );
};
