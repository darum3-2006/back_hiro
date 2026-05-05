import type { Department, MasterColor, Tag, TaskPriority, TaskStatus, User } from '~/types/master';
import { MOCK_USERS } from '~/utils/mock-masters';

// ===== Users (tenant) =====

/**
 * Users マスタは認証ユーザー一覧。専用 API がまだ無いので一時的に mock のまま。
 * NOTE: Step 5+ で /api/users（テナント内ユーザー一覧）を追加して差し替える予定。
 */
export const fetchUsers = async (): Promise<User[]> => {
  return [...MOCK_USERS];
};

// ===== Departments (tenant) =====

/** GET /api/departments */
export const apiListDepartments = (api: typeof $fetch): Promise<Department[]> =>
  api<Department[]>('/departments');

// ===== Task Statuses (project) =====

/** GET /api/projects/:projectId/task-statuses */
export const apiListTaskStatuses = (
  api: typeof $fetch,
  projectId: string,
): Promise<TaskStatus[]> => api<TaskStatus[]>(`/projects/${projectId}/task-statuses`);

/** POST /api/projects/:projectId/task-statuses */
export const apiCreateTaskStatus = (
  api: typeof $fetch,
  projectId: string,
  input: { label: string; color: MasterColor; isTerminal: boolean },
): Promise<TaskStatus> =>
  api<TaskStatus>(`/projects/${projectId}/task-statuses`, { method: 'POST', body: input });

/** PATCH /api/projects/:projectId/task-statuses/:code */
export const apiUpdateTaskStatus = (
  api: typeof $fetch,
  projectId: string,
  code: string,
  patch: { label?: string; color?: MasterColor; isTerminal?: boolean },
): Promise<TaskStatus> =>
  api<TaskStatus>(`/projects/${projectId}/task-statuses/${code}`, {
    method: 'PATCH',
    body: patch,
  });

/** DELETE /api/projects/:projectId/task-statuses/:code */
export const apiDeleteTaskStatus = async (
  api: typeof $fetch,
  projectId: string,
  code: string,
): Promise<void> => {
  await api(`/projects/${projectId}/task-statuses/${code}`, { method: 'DELETE' });
};

/** PATCH /api/projects/:projectId/task-statuses/:code/move */
export const apiMoveTaskStatus = async (
  api: typeof $fetch,
  projectId: string,
  code: string,
  direction: 'up' | 'down',
): Promise<void> => {
  await api(`/projects/${projectId}/task-statuses/${code}/move`, {
    method: 'PATCH',
    body: { direction },
  });
};

/** PUT /api/projects/:projectId/task-statuses/order */
export const apiReorderTaskStatuses = async (
  api: typeof $fetch,
  projectId: string,
  orderedCodes: string[],
): Promise<void> => {
  await api(`/projects/${projectId}/task-statuses/order`, {
    method: 'PUT',
    body: { orderedCodes },
  });
};

// ===== Task Priorities (project) =====

/** GET /api/projects/:projectId/task-priorities */
export const apiListTaskPriorities = (
  api: typeof $fetch,
  projectId: string,
): Promise<TaskPriority[]> => api<TaskPriority[]>(`/projects/${projectId}/task-priorities`);

/** POST /api/projects/:projectId/task-priorities */
export const apiCreateTaskPriority = (
  api: typeof $fetch,
  projectId: string,
  input: { label: string; color: MasterColor },
): Promise<TaskPriority> =>
  api<TaskPriority>(`/projects/${projectId}/task-priorities`, { method: 'POST', body: input });

/** PATCH /api/projects/:projectId/task-priorities/:code */
export const apiUpdateTaskPriority = (
  api: typeof $fetch,
  projectId: string,
  code: string,
  patch: { label?: string; color?: MasterColor },
): Promise<TaskPriority> =>
  api<TaskPriority>(`/projects/${projectId}/task-priorities/${code}`, {
    method: 'PATCH',
    body: patch,
  });

/** DELETE /api/projects/:projectId/task-priorities/:code */
export const apiDeleteTaskPriority = async (
  api: typeof $fetch,
  projectId: string,
  code: string,
): Promise<void> => {
  await api(`/projects/${projectId}/task-priorities/${code}`, { method: 'DELETE' });
};

/** PATCH /api/projects/:projectId/task-priorities/:code/move */
export const apiMoveTaskPriority = async (
  api: typeof $fetch,
  projectId: string,
  code: string,
  direction: 'up' | 'down',
): Promise<void> => {
  await api(`/projects/${projectId}/task-priorities/${code}/move`, {
    method: 'PATCH',
    body: { direction },
  });
};

/** PUT /api/projects/:projectId/task-priorities/order */
export const apiReorderTaskPriorities = async (
  api: typeof $fetch,
  projectId: string,
  orderedCodes: string[],
): Promise<void> => {
  await api(`/projects/${projectId}/task-priorities/order`, {
    method: 'PUT',
    body: { orderedCodes },
  });
};

// ===== Tags (project) =====

/** GET /api/projects/:projectId/tags */
export const apiListTags = (api: typeof $fetch, projectId: string): Promise<Tag[]> =>
  api<Tag[]>(`/projects/${projectId}/tags`);

/** POST /api/projects/:projectId/tags */
export const apiCreateTag = (
  api: typeof $fetch,
  projectId: string,
  input: { name: string; color: MasterColor },
): Promise<Tag> => api<Tag>(`/projects/${projectId}/tags`, { method: 'POST', body: input });

/** PATCH /api/projects/:projectId/tags/:code */
export const apiUpdateTag = (
  api: typeof $fetch,
  projectId: string,
  code: string,
  patch: { name?: string; color?: MasterColor },
): Promise<Tag> =>
  api<Tag>(`/projects/${projectId}/tags/${code}`, { method: 'PATCH', body: patch });

/** DELETE /api/projects/:projectId/tags/:code */
export const apiDeleteTag = async (
  api: typeof $fetch,
  projectId: string,
  code: string,
): Promise<void> => {
  await api(`/projects/${projectId}/tags/${code}`, { method: 'DELETE' });
};

// ===== References (タスク参照件数) =====
//
// NOTE: Tasks backend が未実装のため、当面は常に 0 を返すスタブ。
// Step 5 で実装するときに実 API に差し替える。
const zeroRefs = async (): Promise<{ tasks: number }> => ({ tasks: 0 });

export const countTaskStatusReferences = (_projectId: string, _code: string) => zeroRefs();
export const countTaskPriorityReferences = (_projectId: string, _code: string) => zeroRefs();
export const countTagReferences = (_projectId: string, _code: string) => zeroRefs();
