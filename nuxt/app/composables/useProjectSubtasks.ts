import { apiListProjectSubtasks } from '~/api/subtasks';

/** タスク一覧（案X）の子行用に、プロジェクト内の全サブタスクを取得する。 */
export const useProjectSubtasks = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `project-subtasks:${projectId.value}`,
    () => apiListProjectSubtasks(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};
