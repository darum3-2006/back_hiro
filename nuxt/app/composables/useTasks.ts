import { fetchTasks } from '~/api/tasks';

export const useTasks = (projectId: Ref<string>) =>
  useAsyncData(
    () => `tasks:${projectId.value}`,
    () => fetchTasks(projectId.value),
    { default: () => [], watch: [projectId] },
  );
