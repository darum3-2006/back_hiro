/**
 * スプレッドシート → DB 移行用のマッピング定義。
 *
 * シート構造:
 * - 「システム改修対応一覧」: No, グループ, 日時, 内容, Trello URL, 発言者, 優先度,
 *     即対応, 期限, ステータス, 担当者, ステータス_1, 完了予定日, メモ
 * - 「改修要望対応状況」: No, 記入日, 内容, Trello URL, 依頼部署, 依頼者, 期限,
 *     担当者, ステータス, 完了予定日, メモ
 * - 「■安定期 最優先タスク」: 改修要望対応状況と同じ列
 */

import type { MasterColor } from '../../src/masters/task-status.entity';

/** 正規化後の中間表現（3 シート共通） */
export interface NormalizedTaskRow {
  /** 元シート名（追跡用） */
  sourceSheet: string;
  /** 元シートの No 列 */
  sourceNo: number | null;

  content: string;
  description: string;
  links: { label: string; url: string }[];

  /** INITIAL_STATUSES の label のいずれかに丸める */
  statusLabel: string;
  /** INITIAL_PRIORITIES の label もしくは null */
  priorityLabel: string | null;

  assigneeName: string | null;
  requesterName: string | null;
  requestingDeptName: string | null;

  /** YYYY-MM-DD 形式 or null（フリーテキスト期限は null になる） */
  deadline: string | null;
  plannedCompletionDate: string | null;
}

/** プロジェクトに作るマスタの初期セット */
export const INITIAL_STATUSES: { label: string; color: MasterColor; isTerminal: boolean }[] = [
  { label: '未着手', color: 'neutral', isTerminal: false },
  { label: '対応中', color: 'info', isTerminal: false },
  { label: 'レビュー中', color: 'primary', isTerminal: false },
  { label: '完了', color: 'success', isTerminal: true },
  { label: '見送り', color: 'warning', isTerminal: true },
];

export const INITIAL_PRIORITIES: { label: string; color: MasterColor }[] = [
  { label: '高', color: 'error' },
  { label: '中', color: 'warning' },
  { label: '低', color: 'neutral' },
];

/**
 * シートのステータス文言（自由テキスト）→ 5 段階の label に丸める。
 *
 * 完了系: ✅ / "完了" / "対応完了" / "実施済" / "済"
 * 見送り: "見送り" / "対応しない" / "却下"
 * レビュー中: "レビュー"
 * 対応中: "対応中" / "進行中" / "残タスク" / "着手" / "作業中"
 * その他: "未着手"
 */
export const normalizeStatusLabel = (raw: unknown): string => {
  if (typeof raw !== 'string') return '未着手';
  const s = raw.trim();
  if (s.length === 0) return '未着手';
  if (/✅|完了|対応完了|実施済|済$/.test(s)) return '完了';
  if (/見送り|対応しない|却下/.test(s)) return '見送り';
  if (/レビュー/.test(s)) return 'レビュー中';
  if (/対応中|進行中|残タスク|着手|作業中/.test(s)) return '対応中';
  return '未着手';
};

/** 「高」「中」「低」もしくは null を返す */
export const normalizePriorityLabel = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/高/.test(s)) return '高';
  if (/中/.test(s)) return '中';
  if (/低/.test(s)) return '低';
  return null;
};
