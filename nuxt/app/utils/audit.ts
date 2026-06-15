import type { AuditChange } from '~/types/activity';
import { fmtDate } from './date';

// 監査ログの field キー → 日本語ラベル
const FIELD_LABELS: Record<string, string> = {
  content: 'タイトル',
  description: '説明',
  status: 'ステータス',
  priority: '優先度',
  assignee: '担当',
  requester: '起票者',
  requestingDept: '起票部署',
  deadline: '期限',
  plannedCompletionDate: '完了予定日',
  plannedReleaseDate: 'リリース予定日',
  links: '関連リンク',
  tags: 'タグ',
  flags: 'フラグ',
};

// 日付として整形するフィールド
const DATE_FIELDS = new Set(['deadline', 'plannedCompletionDate', 'plannedReleaseDate']);

const NONE = '（なし）';

/** 値の表示用整形。ラベルがあれば優先、日付フィールドは YYYY/MM/DD、空は「（なし）」。 */
const formatValue = (field: string, value: string | null, label?: string | null): string => {
  if (label != null && label !== '') return label;
  if (value == null || value === '') return NONE;
  if (DATE_FIELDS.has(field)) return fmtDate(value);
  return value;
};

/**
 * 1 件の変更を日本語 1 行に整形する。
 * - 値を持たないフラグのみ（description / links など）は「○○を編集」
 * - それ以外は「○○: 旧 → 新」
 */
export const describeAuditChange = (c: AuditChange): string => {
  const name = FIELD_LABELS[c.field] ?? c.field;
  const flagOnly = c.old === null && c.new === null && !c.oldLabel && !c.newLabel;
  if (flagOnly) return `${name}を編集`;
  return `${name}: ${formatValue(c.field, c.old, c.oldLabel)} → ${formatValue(c.field, c.new, c.newLabel)}`;
};
