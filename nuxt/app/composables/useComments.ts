import { fetchComments } from '~/api/comments'

export const useTaskComments = (projectId: Ref<string>, taskId: Ref<number | null>) =>
  useAsyncData(
    () => `task-comments:${projectId.value}:${taskId.value ?? 'none'}`,
    () => taskId.value !== null ? fetchComments(projectId.value, taskId.value) : Promise.resolve([]),
    { default: () => [], watch: [projectId, taskId] }
  )
