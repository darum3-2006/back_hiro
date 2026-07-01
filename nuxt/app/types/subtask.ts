export interface Subtask {
  id: string;
  projectId: string;
  taskId: string;
  title: string;
  assigneeMemberId: string | null;
  deadline: string | null;
  /** メモ（Markdown） */
  memo: string | null;
  done: boolean;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** タスク一覧（案X）の子行用: サブタスク＋親タスクの seq / content / 期限 */
export interface SubtaskRow extends Subtask {
  parentSeq: number;
  parentContent: string;
  /** 親タスクの期限（子が超過していたら警告） */
  parentDeadline: string | null;
}
