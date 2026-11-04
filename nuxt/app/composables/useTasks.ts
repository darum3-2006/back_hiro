import { apiListTasks, type TaskFilter } from '~/api/tasks';

/**
 * プロジェクトのタスク一覧。既定では完了（終端ステータス）タスクを取得しない
 * （ペイロード削減）。includeCompleted が true のときだけ全件取得する。
 * includeLatestComment が true なら各タスクの最新コメント（latestComment）も取得する。
 * キーにどちらの状態も含めるので、トグル時に再フェッチされる。
 */
export const useTasks = (
  projectId: Ref<string>,
  includeCompleted: Ref<boolean>,
  includeLatestComment: Ref<boolean> = ref(false),
) => {
  const api = useApi();
  return useAsyncData(
    () =>
      `tasks:${projectId.value}:${includeCompleted.value ? 'all' : 'open'}` +
      (includeLatestComment.value ? ':latest-comment' : ''),
    () => {
      const filter: TaskFilter = {};
      if (includeCompleted.value) filter.includeCompleted = true;
      if (includeLatestComment.value) filter.includeLatestComment = true;
      return apiListTasks(api, projectId.value, filter);
    },
    { default: () => [], watch: [projectId, includeCompleted, includeLatestComment] },
  );
};
