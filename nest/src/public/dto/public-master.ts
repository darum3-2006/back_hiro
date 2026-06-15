import type { Department } from '../../departments/department.entity';
import type { Flag } from '../../masters/flag.entity';
import type { Tag } from '../../masters/tag.entity';
import type { TaskPriority } from '../../masters/task-priority.entity';
import type { TaskStatus } from '../../masters/task-status.entity';
import type { ProjectMember } from '../../members/member.entity';

export interface PublicTaskStatus {
  code: string;
  label: string;
  color: string;
  order: number;
  isTerminal: boolean;
}

export const toPublicTaskStatus = (s: TaskStatus): PublicTaskStatus => ({
  code: s.code,
  label: s.label,
  color: s.color,
  order: s.order,
  isTerminal: s.isTerminal,
});

export interface PublicTaskPriority {
  code: string;
  label: string;
  color: string;
  order: number;
}

export const toPublicTaskPriority = (p: TaskPriority): PublicTaskPriority => ({
  code: p.code,
  label: p.label,
  color: p.color,
  order: p.order,
});

export interface PublicTag {
  code: string;
  name: string;
  color: string;
}

export const toPublicTag = (t: Tag): PublicTag => ({ code: t.code, name: t.name, color: t.color });

export interface PublicFlag {
  code: string;
  name: string;
  color: string;
}

export const toPublicFlag = (f: Flag): PublicFlag => ({
  code: f.code,
  name: f.name,
  color: f.color,
});

export interface PublicMember {
  id: string;
  displayName: string;
}

export const toPublicMember = (m: ProjectMember): PublicMember => ({
  id: m.id,
  displayName: m.displayName,
});

export interface PublicDepartment {
  code: string;
  name: string;
}

export const toPublicDepartment = (d: Department): PublicDepartment => ({
  code: d.code,
  name: d.name,
});
