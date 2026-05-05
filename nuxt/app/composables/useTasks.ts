import { apiListTasks } from '~/api/tasks';

export const useTasks = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `tasks:${projectId.value}`,
    () => apiListTasks(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};
