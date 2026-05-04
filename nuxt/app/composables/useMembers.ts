import { fetchMembers } from '~/api/members';

export const useMembers = (projectId: Ref<string>) =>
  useAsyncData(
    () => `members:${projectId.value}`,
    () => fetchMembers(projectId.value),
    { default: () => [], watch: [projectId] }
  );
