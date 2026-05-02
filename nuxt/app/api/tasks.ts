import type { Task } from '~/types/task'
import { MOCK_TASKS } from '~/utils/mock-tasks'

/** GET /projects/{projectId}/tasks */
export async function fetchTasks(projectId: string): Promise<Task[]> {
  return MOCK_TASKS.filter(t => t.projectId === projectId)
}

/** PATCH /projects/{projectId}/tasks/{taskId} */
export async function updateTask(
  projectId: string,
  taskId: number,
  patch: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>
): Promise<Task> {
  const idx = MOCK_TASKS.findIndex(t => t.projectId === projectId && t.id === taskId)
  if (idx < 0) throw new Error(`Task ${taskId} not found in project ${projectId}`)
  MOCK_TASKS[idx] = { ...MOCK_TASKS[idx]!, ...patch }
  return MOCK_TASKS[idx]!
}
