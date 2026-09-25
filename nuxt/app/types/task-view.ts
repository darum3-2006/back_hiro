import type { MasterColor } from '~/types/master';

/** 閲覧履歴 1 件（プロジェクト横断なので projectId / projectName を含む） */
export interface TaskViewEntry {
  shortCode: string;
  seq: number;
  content: string;
  statusLabel: string;
  statusColor: MasterColor;
  projectId: string;
  projectName: string;
  /** 最後に開いた日時 */
  viewedAt: string;
}
