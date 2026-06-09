import type { MasterColor } from '~/types/master';

export interface TaskLink {
  label: string;
  url: string;
}

export interface Task {
  id: string;
  projectId: string;
  /** 共有リンク用の不透明な短縮コード（/:tenantKey/:shortCode） */
  shortCode: string;
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
  plannedReleaseDate: string | null;
  /** 完了日時。ステータスが完了扱い (isTerminal=true) の間だけ値を持つ */
  completedAt: string | null;
  tagCodes: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** グローバル検索（テナント横断）の結果 1 件。 */
export interface TaskSearchResult {
  shortCode: string;
  seq: number;
  content: string;
  statusCode: string;
  statusLabel: string;
  projectId: string;
  projectName: string;
}

/**
 * ホームダッシュボード用「自分のタスク」。プロジェクト横断のため
 * projectId / projectName を含み、表示に必要な最小限のみ。
 */
export interface MyTask {
  shortCode: string;
  seq: number;
  content: string;
  statusCode: string;
  statusLabel: string;
  /** ステータスマスタの表示色（プロジェクト設定）。バッジ色に使う。 */
  statusColor: MasterColor;
  priorityCode: string | null;
  deadline: string | null;
  projectId: string;
  projectName: string;
}
