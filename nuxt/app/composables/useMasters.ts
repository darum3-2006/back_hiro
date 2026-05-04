import {
  fetchDepartments,
  fetchTags,
  fetchTaskPriorities,
  fetchTaskStatuses,
  fetchUsers
} from '~/api/masters';

export const useUsers = () => useAsyncData('users', fetchUsers, { default: () => [] });

export const useDepartments = () =>
  useAsyncData('departments', fetchDepartments, { default: () => [] });

export const useTaskStatuses = (projectId: Ref<string>) =>
  useAsyncData(
    () => `task-statuses:${projectId.value}`,
    () => fetchTaskStatuses(projectId.value),
    { default: () => [], watch: [projectId] }
  );

export const useTaskPriorities = (projectId: Ref<string>) =>
  useAsyncData(
    () => `task-priorities:${projectId.value}`,
    () => fetchTaskPriorities(projectId.value),
    { default: () => [], watch: [projectId] }
  );

export const useTags = (projectId: Ref<string>) =>
  useAsyncData(
    () => `tags:${projectId.value}`,
    () => fetchTags(projectId.value),
    { default: () => [], watch: [projectId] }
  );
