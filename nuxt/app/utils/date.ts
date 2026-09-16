import { parseDate, type DateValue } from '@internationalized/date';
import dayjs from 'dayjs';

// ===== カレンダー UI 用 (@internationalized/date と相互変換) =====

export const isoToCalendarDate = (s: string | null | undefined): DateValue | null => {
  if (!s) return null;
  try {
    return parseDate(s);
  } catch {
    return null;
  }
};

export const calendarDateToIso = (d: DateValue | null | undefined): string | null =>
  d ? d.toString() : null;

// ===== 表示用フォーマッタ (dayjs ベース) =====

const PLACEHOLDER = '—';

/** 日時を `YYYY/MM/DD HH:mm` で表示。null/空は '—' */
export const fmtDateTime = (s: string | null | undefined): string =>
  s ? dayjs(s).format('YYYY/MM/DD HH:mm') : PLACEHOLDER;

/** 日付を `YYYY/MM/DD` で表示。null/空は '—' */
export const fmtDate = (s: string | null | undefined): string =>
  s ? dayjs(s).format('YYYY/MM/DD') : PLACEHOLDER;

/** 相対時間（例: 「5分前」）。null/空は '—' */
export const fmtRelative = (s: string | null | undefined): string =>
  s ? dayjs(s).fromNow() : PLACEHOLDER;

/** 日付範囲を `YYYY/MM/DD 〜 YYYY/MM/DD` で表示。片側だけなら「以降 / 以前」 */
export const fmtDateRange = (from: string | null, to: string | null): string => {
  const f = from ? fmtDate(from) : null;
  const t = to ? fmtDate(to) : null;
  if (f && t) return `${f} 〜 ${t}`;
  if (f) return `${f} 以降`;
  if (t) return `${t} 以前`;
  return '';
};
