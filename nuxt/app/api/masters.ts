import { apiCountTasks } from '~/api/tasks';
import type { Department, MasterColor, Tag, TaskPriority, TaskStatus } from '~/types/master';

// ===== Departments (tenant) =====

/** GET /api/departments */
export const apiListDepartments = (api: typeof $fetch): Promise<Department[]> =>
  api<Department[]>('/departments');

/** POST /api/departments（admin） */
export const apiCreateDepartment = (
  api: typeof $fetch,
  input: { code: string; name: string },
): Promise<Department> => api<Department>('/departments', { method: 'POST', body: input });

/** PATCH /api/departments/:code（admin、名称のみ変更可） */
export const apiUpdateDepartment = (
  api: typeof $fetch,
  code: string,
  patch: { name: string },
): Promise<Department> =>
  api<Department>(`/departments/${encodeURIComponent(code)}`, { method: 'PATCH', body: patch });

/** DELETE /api/departments/:code（admin） */
export const apiDeleteDepartment = async (api: typeof $fetch, code: string): Promise<void> => {
  await api(`/departments/${encodeURIComponent(code)}`, { method: 'DELETE' });
};

// ===== Task Statuses (project) =====

/** GET /api/projects/:projectId/task-statuses */
export const apiListTaskStatuses = (api: typeof $fetch, projectId: string): Promise<TaskStatus[]> =>
  api<TaskStatus[]>(`/projects/${projectId}/task-statuses`);

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

export const countTaskStatusReferences = async (
  api: typeof $fetch,
  projectId: string,
  code: string,
): Promise<{ tasks: number }> => ({
  tasks: await apiCountTasks(api, projectId, { statusCode: code }),
});

export const countTaskPriorityReferences = async (
  api: typeof $fetch,
  projectId: string,
  code: string,
): Promise<{ tasks: number }> => ({
  tasks: await apiCountTasks(api, projectId, { priorityCode: code }),
});

export const countTagReferences = async (
  api: typeof $fetch,
  projectId: string,
  code: string,
): Promise<{ tasks: number }> => ({
  tasks: await apiCountTasks(api, projectId, { tagCode: code }),
});
