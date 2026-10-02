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
  plannedStartDate: '着手予定日',
  plannedCompletionDate: '完了予定日',
  plannedReleaseDate: 'リリース予定日',
  links: '関連リンク',
  tags: 'タグ',
  flags: 'フラグ',
  // プロジェクト間の移動（docs/TASK_MOVE.md）
  project: 'プロジェクト',
  seq: '番号',
};

// 日付として整形するフィールド
const DATE_FIELDS = new Set([
  'deadline',
  'plannedStartDate',
  'plannedCompletionDate',
  'plannedReleaseDate',
]);

const NONE = '（なし）';

/** 値の表示用整形。ラベルがあれば優先、日付フィールドは YYYY/MM/DD、空は「（なし）」。 */
const formatValue = (field: string, value: string | null, label?: string | null): string => {
  if (label != null && label !== '') return label;
  if (value == null || value === '') return NONE;
  if (DATE_FIELDS.has(field)) return fmtDate(value);
  return value;
};

/** 履歴 1 行の部品。URL はリンクとして描画する（省略表示 + 全文はツールチップ） */
export type AuditPart = { kind: 'text'; text: string } | { kind: 'url'; url: string };

const text = (t: string): AuditPart => ({ kind: 'text', text: t });
const url = (u: string): AuditPart => ({ kind: 'url', url: u });

/** 「表示名（URL）」。表示名が無ければ URL だけ */
const linkParts = (u: string | null, label?: string | null): AuditPart[] => {
  if (!u) return [text(label ?? NONE)];
  return label ? [text(`${label}（`), url(u), text('）')] : [url(u)];
};

/** 関連リンクの変更（1 リンク 1 件。nest/src/tasks/task-audit.ts の buildLinkChanges） */
const describeLinkChange = (c: AuditChange): AuditPart[] | null => {
  switch (c.field) {
    case 'link_added':
      return [text('リンクを追加: '), ...linkParts(c.new, c.newLabel)];
    case 'link_removed':
      return [text('リンクを削除: '), ...linkParts(c.old, c.oldLabel)];
    case 'link_reordered':
      return [text('リンクの並び順を変更')];
    case 'link_updated':
      if (c.old === c.new) {
        // URL はそのままで表示名だけ変えた
        return [
          text(`リンクの表示名を変更: ${c.oldLabel ?? NONE} → ${c.newLabel ?? NONE}（`),
          ...(c.new ? [url(c.new)] : []),
          text('）'),
        ];
      }
      if (c.oldLabel === c.newLabel) {
        return [
          text(`リンクを書き換え: ${c.newLabel ? `${c.newLabel}（` : ''}`),
          ...(c.old ? [url(c.old)] : []),
          text(' → '),
          ...(c.new ? [url(c.new)] : []),
          ...(c.newLabel ? [text('）')] : []),
        ];
      }
      return [
        text('リンクを書き換え: '),
        ...linkParts(c.old, c.oldLabel),
        text(' → '),
        ...linkParts(c.new, c.newLabel),
      ];
  }
  return null;
};

/**
 * 1 件の変更を日本語 1 行（部品の列）に整形する。
 * - 値を持たないフラグのみ（description / 旧形式の links など）は「○○を編集」
 * - それ以外は「○○: 旧 → 新」
 */
export const describeAuditChange = (c: AuditChange): AuditPart[] => {
  // サブタスク操作（親タスクの履歴に相乗り）は専用の文言で整形する
  switch (c.field) {
    case 'subtask_added':
      return [text(`サブタスク「${c.new}」を追加`)];
    case 'subtask_completed':
      return [text(`サブタスク「${c.new}」を完了`)];
    case 'subtask_reopened':
      return [text(`サブタスク「${c.new}」を未完了に戻した`)];
    case 'subtask_deleted':
      return [text(`サブタスク「${c.old}」を削除`)];
  }
  const link = describeLinkChange(c);
  if (link) return link;
  const name = FIELD_LABELS[c.field] ?? c.field;
  const flagOnly = c.old === null && c.new === null && !c.oldLabel && !c.newLabel;
  if (flagOnly) return [text(`${name}を編集`)];
  return [
    text(
      `${name}: ${formatValue(c.field, c.old, c.oldLabel)} → ${formatValue(c.field, c.new, c.newLabel)}`,
    ),
  ];
};

/**
 * 長い URL を「ドメイン/…/末尾」の形に縮める（全文はツールチップで出す前提）。
 * URL はドメインと末尾で見分けることが多いので、真ん中を落とす。
 * 例: https://docs.example.com/projects/123/files/spec.md → docs.example.com/…/spec.md
 */
export const shortenUrl = (u: string, max = 50): string => {
  const s = u.replace(/^https?:\/\//, '');
  if (s.length <= max) return s;
  const slash = s.indexOf('/');
  const host = slash === -1 ? s : s.slice(0, slash);
  // ドメイン自体が長い / パスが無い場合は末尾を落とす
  if (slash === -1 || host.length > max - 6) return `${s.slice(0, max - 1)}…`;
  const rest = s.slice(slash + 1);
  const last = rest.split('/').filter(Boolean).pop() ?? rest;
  // 「host/…/」の 3 文字ぶんを引いた残りに末尾セグメントを収める（長ければその頭も落とす）
  const room = max - host.length - 3;
  const tail = last.length <= room ? last : `…${last.slice(-(room - 1))}`;
  return last === rest ? `${host}/${tail}` : `${host}/…/${tail}`;
};

/** http(s) の URL だけリンクにする（javascript: 等を href に入れない） */
export const isHttpUrl = (u: string): boolean => /^https?:\/\//i.test(u);
