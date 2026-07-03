import { apiListTaskRelations } from '~/api/relations';

/** タスク詳細の「関連タスク」欄用に、起点タスクから見た関連一覧を取得する。 */
export const useTaskRelations = (projectId: Ref<string>, taskId: Ref<string | null>) => {
  const api = useApi();
  return useAsyncData(
    () => `task-relations:${projectId.value}:${taskId.value ?? 'none'}`,
    () =>
      taskId.value !== null
        ? apiListTaskRelations(api, projectId.value, taskId.value)
        : Promise.resolve([]),
    { default: () => [], watch: [projectId, taskId] },
  );
};
