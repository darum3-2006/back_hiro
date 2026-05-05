import type { Department, MasterColor, Tag, TaskPriority, TaskStatus, User } from '~/types/master';
import {
  MOCK_TAGS,
  MOCK_TASK_PRIORITIES,
  MOCK_TASK_STATUSES,
  MOCK_USERS,
} from '~/utils/mock-masters';
import { MOCK_TASKS } from '~/utils/mock-tasks';

const randomCode = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 6)}`;

// ===== Users (tenant) =====

/** GET /tenants/me/users */
export const fetchUsers = async (): Promise<User[]> => {
  return [...MOCK_USERS];
};

// ===== Departments (tenant) =====

/** GET /api/departments */
export const apiListDepartments = (api: typeof $fetch): Promise<Department[]> =>
  api<Department[]>('/departments');

// ===== Task Statuses (project) =====

/** GET /projects/{projectId}/task-statuses */
export const fetchTaskStatuses = async (projectId: string): Promise<TaskStatus[]> => {
  return MOCK_TASK_STATUSES.filter((s) => s.projectId === projectId).sort(
    (a, b) => a.order - b.order,
  );
};

/** POST /projects/{projectId}/task-statuses */
export const createTaskStatus = async (
  projectId: string,
  input: { label: string; color: MasterColor; isTerminal: boolean },
): Promise<TaskStatus> => {
  const projectStatuses = MOCK_TASK_STATUSES.filter((s) => s.projectId === projectId);
  const maxOrder =
    projectStatuses.length === 0 ? 0 : Math.max(...projectStatuses.map((s) => s.order));
  const status: TaskStatus = {
    projectId,
    code: randomCode('s'),
    label: input.label,
    color: input.color,
    order: maxOrder + 1,
    isTerminal: input.isTerminal,
  };
  MOCK_TASK_STATUSES.push(status);
  return status;
};

/** PATCH /projects/{projectId}/task-statuses/{code} */
export const updateTaskStatus = async (
  projectId: string,
  code: string,
  patch: Partial<Omit<TaskStatus, 'projectId' | 'code'>>,
): Promise<TaskStatus> => {
  const idx = MOCK_TASK_STATUSES.findIndex((s) => s.projectId === projectId && s.code === code);
  if (idx < 0) throw new Error(`TaskStatus ${code} not found`);
  MOCK_TASK_STATUSES[idx] = { ...MOCK_TASK_STATUSES[idx]!, ...patch };
  return MOCK_TASK_STATUSES[idx]!;
};

/** DELETE /projects/{projectId}/task-statuses/{code} */
export const deleteTaskStatus = async (projectId: string, code: string): Promise<void> => {
  const idx = MOCK_TASK_STATUSES.findIndex((s) => s.projectId === projectId && s.code === code);
  if (idx < 0) throw new Error(`TaskStatus ${code} not found`);
  MOCK_TASK_STATUSES.splice(idx, 1);
};

/** GET /projects/{projectId}/task-statuses/{code}/references */
export const countTaskStatusReferences = async (
  projectId: string,
  code: string,
): Promise<{ tasks: number }> => {
  const tasks = MOCK_TASKS.filter((t) => t.projectId === projectId && t.statusCode === code).length;
  return { tasks };
};

const swapMasterOrder = <T extends { code: string; order: number; projectId: string }>(
  list: T[],
  projectId: string,
  code: string,
  direction: 'up' | 'down',
): void => {
  const sorted = list.filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((s) => s.code === code);
  if (idx < 0) return;
  const partnerIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (partnerIdx < 0 || partnerIdx >= sorted.length) return;
  const a = sorted[idx]!;
  const b = sorted[partnerIdx]!;
  [a.order, b.order] = [b.order, a.order];
};

/** PATCH /projects/{projectId}/task-statuses/{code}/move */
export const moveTaskStatus = async (
  projectId: string,
  code: string,
  direction: 'up' | 'down',
): Promise<void> => {
  swapMasterOrder(MOCK_TASK_STATUSES, projectId, code, direction);
};

/** PUT /projects/{projectId}/task-statuses/order */
export const reorderTaskStatuses = async (
  projectId: string,
  orderedCodes: string[],
): Promise<void> => {
  const list = MOCK_TASK_STATUSES.filter((s) => s.projectId === projectId);
  for (const status of list) {
    const idx = orderedCodes.indexOf(status.code);
    if (idx >= 0) status.order = idx + 1;
  }
};

// ===== Task Priorities (project) =====

/** GET /projects/{projectId}/task-priorities */
export const fetchTaskPriorities = async (projectId: string): Promise<TaskPriority[]> => {
  return MOCK_TASK_PRIORITIES.filter((p) => p.projectId === projectId).sort(
    (a, b) => a.order - b.order,
  );
};

/** POST /projects/{projectId}/task-priorities */
export const createTaskPriority = async (
  projectId: string,
  input: { label: string; color: MasterColor },
): Promise<TaskPriority> => {
  const projectPriorities = MOCK_TASK_PRIORITIES.filter((p) => p.projectId === projectId);
  const maxOrder =
    projectPriorities.length === 0 ? 0 : Math.max(...projectPriorities.map((p) => p.order));
  const priority: TaskPriority = {
    projectId,
    code: randomCode('p'),
    label: input.label,
    color: input.color,
    order: maxOrder + 1,
  };
  MOCK_TASK_PRIORITIES.push(priority);
  return priority;
};

/** PATCH /projects/{projectId}/task-priorities/{code} */
export const updateTaskPriority = async (
  projectId: string,
  code: string,
  patch: Partial<Omit<TaskPriority, 'projectId' | 'code'>>,
): Promise<TaskPriority> => {
  const idx = MOCK_TASK_PRIORITIES.findIndex((p) => p.projectId === projectId && p.code === code);
  if (idx < 0) throw new Error(`TaskPriority ${code} not found`);
  MOCK_TASK_PRIORITIES[idx] = { ...MOCK_TASK_PRIORITIES[idx]!, ...patch };
  return MOCK_TASK_PRIORITIES[idx]!;
};

/** DELETE /projects/{projectId}/task-priorities/{code} */
export const deleteTaskPriority = async (projectId: string, code: string): Promise<void> => {
  const idx = MOCK_TASK_PRIORITIES.findIndex((p) => p.projectId === projectId && p.code === code);
  if (idx < 0) throw new Error(`TaskPriority ${code} not found`);
  MOCK_TASK_PRIORITIES.splice(idx, 1);
};

/** GET /projects/{projectId}/task-priorities/{code}/references */
export const countTaskPriorityReferences = async (
  projectId: string,
  code: string,
): Promise<{ tasks: number }> => {
  const tasks = MOCK_TASKS.filter(
    (t) => t.projectId === projectId && t.priorityCode === code,
  ).length;
  return { tasks };
};

/** PATCH /projects/{projectId}/task-priorities/{code}/move */
export const moveTaskPriority = async (
  projectId: string,
  code: string,
  direction: 'up' | 'down',
): Promise<void> => {
  swapMasterOrder(MOCK_TASK_PRIORITIES, projectId, code, direction);
};

/** PUT /projects/{projectId}/task-priorities/order */
export const reorderTaskPriorities = async (
  projectId: string,
  orderedCodes: string[],
): Promise<void> => {
  const list = MOCK_TASK_PRIORITIES.filter((p) => p.projectId === projectId);
  for (const priority of list) {
    const idx = orderedCodes.indexOf(priority.code);
    if (idx >= 0) priority.order = idx + 1;
  }
};

// ===== Tags (project) =====

/** GET /projects/{projectId}/tags */
export const fetchTags = async (projectId: string): Promise<Tag[]> => {
  return MOCK_TAGS.filter((t) => t.projectId === projectId);
};

/** POST /projects/{projectId}/tags */
export const createTag = async (
  projectId: string,
  input: { name: string; color: MasterColor },
): Promise<Tag> => {
  const tag: Tag = {
    projectId,
    code: randomCode('t'),
    name: input.name,
    color: input.color,
  };
  MOCK_TAGS.push(tag);
  return tag;
};

/** PATCH /projects/{projectId}/tags/{code} */
export const updateTag = async (
  projectId: string,
  code: string,
  patch: Partial<Omit<Tag, 'projectId' | 'code'>>,
): Promise<Tag> => {
  const idx = MOCK_TAGS.findIndex((t) => t.projectId === projectId && t.code === code);
  if (idx < 0) throw new Error(`Tag ${code} not found`);
  MOCK_TAGS[idx] = { ...MOCK_TAGS[idx]!, ...patch };
  return MOCK_TAGS[idx]!;
};

/** DELETE /projects/{projectId}/tags/{code} */
export const deleteTag = async (projectId: string, code: string): Promise<void> => {
  const idx = MOCK_TAGS.findIndex((t) => t.projectId === projectId && t.code === code);
  if (idx < 0) throw new Error(`Tag ${code} not found`);
  MOCK_TAGS.splice(idx, 1);
};

/** GET /projects/{projectId}/tags/{code}/references */
export const countTagReferences = async (
  projectId: string,
  code: string,
): Promise<{ tasks: number }> => {
  const tasks = MOCK_TASKS.filter(
    (t) => t.projectId === projectId && t.tagCodes.includes(code),
  ).length;
  return { tasks };
};
