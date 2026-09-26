import type { TaskViewEntry } from '~/types/task-view';

/** POST /api/projects/:projectId/tasks/:taskId/view — タスクの詳細を開いたことを記録する */
export const apiRecordTaskView = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
): Promise<void> => api(`/projects/${projectId}/tasks/${taskId}/view`, { method: 'POST' });

/** GET /api/me/task-views — 自分の閲覧履歴（プロジェクト横断・新しい順・直近 30 件） */
export const apiListMyTaskViews = (api: typeof $fetch): Promise<TaskViewEntry[]> =>
  api<TaskViewEntry[]>('/me/task-views');
