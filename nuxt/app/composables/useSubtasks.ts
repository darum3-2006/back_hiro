import { apiListSubtasks } from '~/api/subtasks';

export const useSubtasks = (projectId: Ref<string>, taskId: Ref<string | null>) => {
  const api = useApi();
  return useAsyncData(
    () => `task-subtasks:${projectId.value}:${taskId.value ?? 'none'}`,
    () =>
      taskId.value !== null
        ? apiListSubtasks(api, projectId.value, taskId.value)
        : Promise.resolve([]),
    { default: () => [], watch: [projectId, taskId] },
  );
};
