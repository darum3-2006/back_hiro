import { apiListSavedViews } from '~/api/saved-views';

export const useSavedViews = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `saved-views:${projectId.value}`,
    () => apiListSavedViews(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};
