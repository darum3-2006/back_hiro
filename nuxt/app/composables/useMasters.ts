import {
  apiListDepartments,
  apiListFlags,
  apiListTags,
  apiListTaskPriorities,
  apiListTaskStatuses,
} from '~/api/masters';
import { apiListUsers } from '~/api/users';

export const useUsers = () => {
  const api = useApi();
  return useAsyncData('users', () => apiListUsers(api), { default: () => [] });
};

export const useDepartments = () => {
  const api = useApi();
  return useAsyncData('departments', () => apiListDepartments(api), { default: () => [] });
};

export const useTaskStatuses = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `task-statuses:${projectId.value}`,
    () => apiListTaskStatuses(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};

export const useTaskPriorities = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `task-priorities:${projectId.value}`,
    () => apiListTaskPriorities(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};

export const useTags = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `tags:${projectId.value}`,
    () => apiListTags(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};

export const useFlags = (projectId: Ref<string>) => {
  const api = useApi();
  return useAsyncData(
    () => `flags:${projectId.value}`,
    () => apiListFlags(api, projectId.value),
    { default: () => [], watch: [projectId] },
  );
};
