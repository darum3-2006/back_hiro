import type { RelationKind, TaskRelationEdge, TaskRelationView } from '~/types/relation';

export interface CreateTaskRelationInput {
  otherTaskId: string;
  kind: RelationKind;
}

/** GET /api/projects/:projectId/tasks/:taskId/relations */
export const apiListTaskRelations = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
): Promise<TaskRelationView[]> =>
  api<TaskRelationView[]>(`/projects/${projectId}/tasks/${taskId}/relations`);

/** POST /api/projects/:projectId/tasks/:taskId/relations */
export const apiCreateTaskRelation = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  input: CreateTaskRelationInput,
): Promise<TaskRelationView> =>
  api<TaskRelationView>(`/projects/${projectId}/tasks/${taskId}/relations`, {
    method: 'POST',
    body: input,
  });

/** DELETE /api/projects/:projectId/tasks/:taskId/relations/:id */
export const apiDeleteTaskRelation = async (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  id: string,
): Promise<void> => {
  await api(`/projects/${projectId}/tasks/${taskId}/relations/${id}`, { method: 'DELETE' });
};

/** GET /api/projects/:projectId/relations — プロジェクト内の全関連（ガント用） */
export const apiListProjectRelations = (
  api: typeof $fetch,
  projectId: string,
): Promise<TaskRelationEdge[]> => api<TaskRelationEdge[]>(`/projects/${projectId}/relations`);
