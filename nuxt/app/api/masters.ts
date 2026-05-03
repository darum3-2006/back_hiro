import type { Department, Tag, TaskPriority, TaskStatus, User } from '~/types/master'
import {
  MOCK_DEPARTMENTS,
  MOCK_TAGS,
  MOCK_TASK_PRIORITIES,
  MOCK_TASK_STATUSES,
  MOCK_USERS
} from '~/utils/mock-masters'

/** GET /tenants/me/users */
export async function fetchUsers(): Promise<User[]> {
  return [...MOCK_USERS]
}

/** GET /tenants/me/departments */
export async function fetchDepartments(): Promise<Department[]> {
  return [...MOCK_DEPARTMENTS]
}

/** GET /projects/{projectId}/task-statuses */
export async function fetchTaskStatuses(projectId: string): Promise<TaskStatus[]> {
  return MOCK_TASK_STATUSES.filter((s) => s.projectId === projectId).sort(
    (a, b) => a.order - b.order
  )
}

/** GET /projects/{projectId}/task-priorities */
export async function fetchTaskPriorities(projectId: string): Promise<TaskPriority[]> {
  return MOCK_TASK_PRIORITIES.filter((p) => p.projectId === projectId).sort(
    (a, b) => a.order - b.order
  )
}

/** GET /projects/{projectId}/tags */
export async function fetchTags(projectId: string): Promise<Tag[]> {
  return MOCK_TAGS.filter((t) => t.projectId === projectId)
}
