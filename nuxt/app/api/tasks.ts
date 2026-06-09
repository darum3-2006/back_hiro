import type { TaskActivity } from '~/types/activity';
import type { Task, TaskLink } from '~/types/task';

export interface CreateTaskInput {
  content: string;
  description?: string;
  links?: TaskLink[];
  statusCode: string;
  priorityCode?: string | null;
  assigneeMemberId?: string | null;
  requesterMemberId?: string | null;
  requestingDeptCode?: string | null;
  deadline?: string | null;
  plannedCompletionDate?: string | null;
  plannedReleaseDate?: string | null;
  tagCodes?: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export interface TaskFilter {
  statusCode?: string;
  priorityCode?: string;
  tagCode?: string;
  assigneeMemberId?: string;
  requesterMemberId?: string;
  requestingDeptCode?: string;
}

const buildQuery = (filter: TaskFilter): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

/** GET /api/tasks/by-code/:code — 共有リンクの短縮コードからタスクを解決する */
export const apiResolveTaskByCode = (
  api: typeof $fetch,
  code: string,
): Promise<{ projectId: string; id: string }> =>
  api<{ projectId: string; id: string }>(`/tasks/by-code/${code}`);

/** GET /api/projects/:projectId/tasks/:taskId/activities — タスクの変更履歴（監査ログ） */
export const apiListTaskActivities = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
): Promise<TaskActivity[]> =>
  api<TaskActivity[]>(`/projects/${projectId}/tasks/${taskId}/activities`);

/** GET /api/projects/:projectId/tasks */
export const apiListTasks = (
  api: typeof $fetch,
  projectId: string,
  filter: TaskFilter = {},
): Promise<Task[]> => api<Task[]>(`/projects/${projectId}/tasks${buildQuery(filter)}`);

/** GET /api/projects/:projectId/tasks/count */
export const apiCountTasks = async (
  api: typeof $fetch,
  projectId: string,
  filter: TaskFilter = {},
): Promise<number> => {
  const res = await api<{ count: number }>(
    `/projects/${projectId}/tasks/count${buildQuery(filter)}`,
  );
  return res.count;
};

/** POST /api/projects/:projectId/tasks */
export const apiCreateTask = (
  api: typeof $fetch,
  projectId: string,
  input: CreateTaskInput,
): Promise<Task> => api<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: input });

/** PATCH /api/projects/:projectId/tasks/:id */
export const apiUpdateTask = (
  api: typeof $fetch,
  projectId: string,
  id: string,
  patch: UpdateTaskInput,
): Promise<Task> =>
  api<Task>(`/projects/${projectId}/tasks/${id}`, { method: 'PATCH', body: patch });

/** DELETE /api/projects/:projectId/tasks/:id */
export const apiDeleteTask = async (
  api: typeof $fetch,
  projectId: string,
  id: string,
): Promise<void> => {
  await api(`/projects/${projectId}/tasks/${id}`, { method: 'DELETE' });
};
