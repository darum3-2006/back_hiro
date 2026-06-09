import { apiListTaskActivities } from '~/api/tasks';

/** タスクの変更履歴（監査ログ）を時系列で取得する。useTaskComments と同じ流儀。 */
export const useTaskActivities = (projectId: Ref<string>, taskId: Ref<string | null>) => {
  const api = useApi();
  return useAsyncData(
    () => `task-activities:${projectId.value}:${taskId.value ?? 'none'}`,
    () =>
      taskId.value !== null
        ? apiListTaskActivities(api, projectId.value, taskId.value)
        : Promise.resolve([]),
    { default: () => [], watch: [projectId, taskId] },
  );
};
