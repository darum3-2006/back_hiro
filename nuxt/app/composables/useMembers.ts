import { apiListMembers } from '~/api/members';

export const useMembers = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `members:${projectId.value}`,
    () => apiListMembers(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};
