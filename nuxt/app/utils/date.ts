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
