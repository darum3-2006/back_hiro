import type { MasterColor } from '~/types/master';

export interface TaskMoveOption {
  value: string;
  label: string;
  color?: MasterColor;
}

/** 移動の事前確認。付け替えの初期値と、移動で失われるもの（サーバが判定） */
export interface TaskMovePreview {
  task: { id: string; seq: number; content: string };
  target: { id: string; name: string };
  defaults: {
    statusCode: string;
    priorityCode: string | null;
    assigneeMemberId: string | null;
    requesterMemberId: string | null;
  };
  source: {
    statusLabel: string | null;
    priorityLabel: string | null;
    assigneeName: string | null;
    requesterName: string | null;
  };
  options: {
    statuses: TaskMoveOption[];
    priorities: TaskMoveOption[];
    assignees: TaskMoveOption[];
    requesters: TaskMoveOption[];
  };
  tags: { kept: string[]; dropped: string[] };
  flags: { kept: string[]; dropped: string[] };
  subtasks: { count: number; droppedAssignees: string[]; droppedFlags: string[] };
  comments: { count: number; unknownAuthors: { name: string; count: number }[] };
  relations: { count: number };
}

export interface MoveTaskInput {
  targetProjectId: string;
  statusCode: string;
  priorityCode: string | null;
  assigneeMemberId: string | null;
  requesterMemberId: string | null;
}

export interface MoveTaskResult {
  projectId: string;
  id: string;
  seq: number;
  shortCode: string;
}
