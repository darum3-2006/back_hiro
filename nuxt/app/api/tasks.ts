import type { TaskActivity } from '~/types/activity';
import type { MyTask, Task, TaskLink, TaskSearchResult } from '~/types/task';

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
  plannedStartDate?: string | null;
  plannedCompletionDate?: string | null;
  plannedReleaseDate?: string | null;
  tagCodes?: string[];
  flagCodes?: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export interface TaskFilter {
  statusCode?: string;
  priorityCode?: string;
  tagCode?: string;
  flagCode?: string;
  assigneeMemberId?: string;
  requesterMemberId?: string;
  requestingDeptCode?: string;
  /** 完了（終端ステータス）タスクも含めて取得するか。一覧でのみ使用 */
  includeCompleted?: boolean;
}

const buildQuery = (filter: TaskFilter): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

/** GET /api/search/tasks?q= — タイトル/説明/コード横断でタスクを検索（テナント横断） */
export const apiSearchTasks = (
  api: typeof $fetch,
  q: string,
  limit = 20,
): Promise<TaskSearchResult[]> =>
  api<TaskSearchResult[]>(`/search/tasks?q=${encodeURIComponent(q)}&limit=${limit}`);

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

/** GET /api/me/tasks — 自分が担当の未完了タスク（テナント横断） */
export const apiListMyTasks = (api: typeof $fetch): Promise<MyTask[]> => api<MyTask[]>(`/me/tasks`);

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

/** GET /api/projects/:projectId/tasks/by-seq/:seq — 一覧に載らないタスク（完了済み等）の単体解決 */
export const apiGetTaskBySeq = (
  api: typeof $fetch,
  projectId: string,
  seq: number,
): Promise<Task> => api<Task>(`/projects/${projectId}/tasks/by-seq/${seq}`);

/** GET /api/projects/:projectId/tasks/:id */
export const apiGetTask = (api: typeof $fetch, projectId: string, id: string): Promise<Task> =>
  api<Task>(`/projects/${projectId}/tasks/${id}`);

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

export interface BulkUpdateTasksInput {
  ids: string[];
  statusCode?: string;
  assigneeMemberId?: string | null;
  priorityCode?: string | null;
  deadline?: string | null;
  plannedStartDate?: string | null;
  plannedCompletionDate?: string | null;
  addTagCodes?: string[];
  removeTagCodes?: string[];
  addFlagCodes?: string[];
  removeFlagCodes?: string[];
}

/** PATCH /api/projects/:projectId/tasks/bulk — 複数タスクへ 1 フィールドを一括適用 */
export const apiBulkUpdateTasks = (
  api: typeof $fetch,
  projectId: string,
  input: BulkUpdateTasksInput,
): Promise<{ updated: number }> =>
  api<{ updated: number }>(`/projects/${projectId}/tasks/bulk`, { method: 'PATCH', body: input });

/** DELETE /api/projects/:projectId/tasks/:id */
export const apiDeleteTask = async (
  api: typeof $fetch,
  projectId: string,
  id: string,
): Promise<void> => {
  await api(`/projects/${projectId}/tasks/${id}`, { method: 'DELETE' });
};
