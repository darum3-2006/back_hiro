import { apiListProjectRelations } from '~/api/relations';

/** ガントのハイライト / 依存違反表示用に、プロジェクト内の全関連（有向エッジ）を取得する。 */
export const useProjectRelations = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `project-relations:${projectId.value}`,
    () => apiListProjectRelations(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};
