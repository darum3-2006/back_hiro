export type MasterColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'rose'
  | 'sky'
  | 'amber'
  | 'fuchsia'
  | 'emerald'
  | 'violet';

export interface TaskStatus {
  projectId: string;
  code: string;
  label: string;
  color: MasterColor;
  order: number;
  isTerminal: boolean;
}

export interface TaskPriority {
  projectId: string;
  code: string;
  label: string;
  color: MasterColor;
  order: number;
}

export interface Tag {
  projectId: string;
  code: string;
  name: string;
  color: MasterColor;
}

export interface Flag {
  projectId: string;
  code: string;
  name: string;
  color: MasterColor;
}

export interface Department {
  code: string;
  name: string;
}

export type UserRole = 'admin' | 'power_user' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
