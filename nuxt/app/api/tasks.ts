import type { Task } from '~/types/task'
import { MOCK_TASKS } from '~/utils/mock-tasks'

/** GET /projects/{projectId}/tasks */
export async function fetchTasks(projectId: string): Promise<Task[]> {
  return MOCK_TASKS.filter((t) => t.projectId === projectId)
}

/** PATCH /projects/{projectId}/tasks/{taskId} */
export async function updateTask(
  projectId: string,
  taskId: number,
  patch: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>
): Promise<Task> {
  const idx = MOCK_TASKS.findIndex((t) => t.projectId === projectId && t.id === taskId)
  if (idx < 0) throw new Error(`Task ${taskId} not found in project ${projectId}`)
  MOCK_TASKS[idx] = { ...MOCK_TASKS[idx]!, ...patch }
  return MOCK_TASKS[idx]!
}

/** POST /projects/{projectId}/tasks */
export async function createTask(
  projectId: string,
  input: Omit<Task, 'id' | 'projectId' | 'createdAt'>
): Promise<Task> {
  const nextId = MOCK_TASKS.length === 0 ? 1 : Math.max(...MOCK_TASKS.map((t) => t.id)) + 1
  const task: Task = {
    id: nextId,
    projectId,
    createdAt: new Date().toISOString().slice(0, 19),
    ...input
  }
  MOCK_TASKS.push(task)
  return task
}
