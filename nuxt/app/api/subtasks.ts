import type { Subtask, SubtaskRow } from '~/types/subtask';

/** GET /api/projects/:projectId/subtasks — プロジェクト内の全サブタスク（親 seq/content 付き） */
export const apiListProjectSubtasks = (
  api: typeof $fetch,
  projectId: string,
): Promise<SubtaskRow[]> => api<SubtaskRow[]>(`/projects/${projectId}/subtasks`);

export interface CreateSubtaskInput {
  title: string;
  assigneeMemberId?: string | null;
  deadline?: string | null;
  memo?: string | null;
  done?: boolean;
  /** フラグコード（全置換） */
  flagCodes?: string[];
}

export type UpdateSubtaskInput = Partial<CreateSubtaskInput>;

const base = (projectId: string, taskId: string): string =>
  `/projects/${projectId}/tasks/${taskId}/subtasks`;

/** GET /api/projects/:projectId/tasks/:taskId/subtasks */
export const apiListSubtasks = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
): Promise<Subtask[]> => api<Subtask[]>(base(projectId, taskId));

/** POST /api/projects/:projectId/tasks/:taskId/subtasks */
export const apiCreateSubtask = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  input: CreateSubtaskInput,
): Promise<Subtask> => api<Subtask>(base(projectId, taskId), { method: 'POST', body: input });

/** PATCH /api/projects/:projectId/tasks/:taskId/subtasks/:id */
export const apiUpdateSubtask = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  id: string,
  patch: UpdateSubtaskInput,
): Promise<Subtask> =>
  api<Subtask>(`${base(projectId, taskId)}/${id}`, { method: 'PATCH', body: patch });

/** DELETE /api/projects/:projectId/tasks/:taskId/subtasks/:id */
export const apiDeleteSubtask = async (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  id: string,
): Promise<void> => {
  await api(`${base(projectId, taskId)}/${id}`, { method: 'DELETE' });
};

/** PATCH /api/projects/:projectId/tasks/:taskId/subtasks/reorder */
export const apiReorderSubtasks = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  ids: string[],
): Promise<Subtask[]> =>
  api<Subtask[]>(`${base(projectId, taskId)}/reorder`, { method: 'PATCH', body: { ids } });
