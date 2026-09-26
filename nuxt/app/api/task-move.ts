import type { MoveTaskInput, MoveTaskResult, TaskMovePreview } from '~/types/task-move';

/** GET /api/projects/:projectId/tasks/:taskId/move-preview?to= — 移動の事前確認（データは変えない） */
export const apiPreviewTaskMove = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  targetProjectId: string,
): Promise<TaskMovePreview> =>
  api<TaskMovePreview>(`/projects/${projectId}/tasks/${taskId}/move-preview`, {
    query: { to: targetProjectId },
  });

/** POST /api/projects/:projectId/tasks/:taskId/move — タスクを別のプロジェクトへ移す（元に戻せない） */
export const apiMoveTask = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  input: MoveTaskInput,
): Promise<MoveTaskResult> =>
  api<MoveTaskResult>(`/projects/${projectId}/tasks/${taskId}/move`, {
    method: 'POST',
    body: input,
  });
