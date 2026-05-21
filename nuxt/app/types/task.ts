export interface TaskLink {
  label: string;
  url: string;
}

export interface Task {
  id: string;
  projectId: string;
  /** プロジェクト内連番（表示用 #N） */
  seq: number;
  content: string;
  links: TaskLink[];
  requesterMemberId: string | null;
  requestingDeptCode: string | null;
  assigneeMemberId: string | null;
  priorityCode: string | null;
  statusCode: string;
  deadline: string | null;
  plannedCompletionDate: string | null;
  /** 完了日時。ステータスが完了扱い (isTerminal=true) の間だけ値を持つ */
  completedAt: string | null;
  tagCodes: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
}
