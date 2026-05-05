import { apiListComments } from '~/api/comments';

export const useTaskComments = (projectId: Ref<string>, taskId: Ref<string | null>) => {
  const api = useApi();
  return useAsyncData(
    () => `task-comments:${projectId.value}:${taskId.value ?? 'none'}`,
    () =>
      taskId.value !== null
        ? apiListComments(api, projectId.value, taskId.value)
        : Promise.resolve([]),
    { default: () => [], watch: [projectId, taskId] },
  );
};
