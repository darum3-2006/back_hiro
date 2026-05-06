import dayjs from 'dayjs';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import {
  normalizePriorityLabel,
  normalizeStatusLabel,
  type NormalizedTaskRow,
} from './mapping';

export const readWorkbook = (filePath: string): XLSX.WorkBook => {
  const buf = readFileSync(filePath);
  return XLSX.read(buf, { type: 'buffer', cellDates: true });
};

export const sheetToJson = (
  workbook: XLSX.WorkBook,
  sheetName: string,
): Record<string, unknown>[] => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
};

// ===== ヘルパ =====

const asString = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
};

const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
};

/** xlsx の cellDates:true で Date が返るので、YYYY-MM-DD に整形。文字列の場合は dayjs でパース可能なら採用 */
const asIsoDate = (v: unknown): string | null => {
  if (v instanceof Date) {
    return dayjs(v).format('YYYY-MM-DD');
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.length === 0) return null;
    // "3時間以内（当日）" のような自由テキスト期限は null
    const d = dayjs(s);
    return d.isValid() && /\d{4}/.test(s) ? d.format('YYYY-MM-DD') : null;
  }
  return null;
};

const buildLinks = (raw: Record<string, unknown>): { label: string; url: string }[] => {
  const url = asString(raw['Trello URL']);
  return url ? [{ label: 'Trello', url }] : [];
};

/**
 * 担当者・依頼者の名前ゆれを補正する。
 * - 「・」を含むもの（複数人併記）は null にする
 * - 先頭が「かんとく」なら「かんとく」に統一（「かんとく？」「かんとくさん」などの揺れ吸収）
 */
const cleanPersonName = (s: string | null): string | null => {
  if (!s) return null;
  if (s.includes('・')) return null;
  if (/^かんとく/.test(s)) return 'かんとく';
  return s;
};

// ===== シート別 normalize =====

/** 「システム改修対応一覧」: 期限が自由テキスト多め、担当者欄 null 多い */
const normalizeKaishuRow = (raw: Record<string, unknown>): NormalizedTaskRow | null => {
  const content = asString(raw['内容']);
  if (!content) return null; // 内容空はスキップ

  // L 列「ステータス_1」が「〇」「○」なら完了扱い（J 列の自由文言より優先）
  const statusOne = asString(raw['ステータス_1']);
  const isMarkedDone = statusOne === '〇' || statusOne === '○';

  // description には「グループ・日時・発言者・期限テキスト・メモ」を集約
  const descParts: string[] = [];
  const group = asString(raw['グループ']);
  const datetime = asString(raw['日時']);
  const speaker = asString(raw['発言者']);
  const deadlineRaw = asString(raw['期限']);
  const memo = asString(raw['メモ']);
  if (group) descParts.push(`グループ: ${group}`);
  if (datetime) descParts.push(`日時: ${datetime}`);
  if (speaker) descParts.push(`発言者: ${speaker}`);
  if (deadlineRaw && asIsoDate(deadlineRaw) === null) {
    descParts.push(`期限メモ: ${deadlineRaw}`);
  }
  if (memo) descParts.push(`メモ:\n${memo}`);

  return {
    sourceSheet: 'システム改修対応一覧',
    sourceNo: asNumber(raw['No']),
    content,
    description: descParts.join('\n'),
    links: buildLinks(raw),
    statusLabel: isMarkedDone ? '完了' : normalizeStatusLabel(raw['ステータス']),
    priorityLabel: normalizePriorityLabel(raw['優先度']),
    assigneeName: cleanPersonName(asString(raw['担当者'])),
    requesterName: cleanPersonName(asString(raw['発言者'])),
    requestingDeptName: null,
    deadline: asIsoDate(raw['期限']),
    plannedCompletionDate: asIsoDate(raw['完了予定日']),
  };
};

/** 「改修要望対応状況」「■安定期 最優先タスク」: 列構造が同じ */
const normalizeRequestRow =
  (sheetName: string) =>
  (raw: Record<string, unknown>): NormalizedTaskRow | null => {
    const content = asString(raw['内容']);
    if (!content) return null;

    const descParts: string[] = [];
    const recordedAt = raw['記入日'];
    if (recordedAt instanceof Date) {
      descParts.push(`記入日: ${dayjs(recordedAt).format('YYYY-MM-DD')}`);
    }
    const memo = asString(raw['メモ']);
    if (memo) descParts.push(`メモ:\n${memo}`);

    return {
      sourceSheet: sheetName,
      sourceNo: asNumber(raw['No']),
      content,
      description: descParts.join('\n'),
      links: buildLinks(raw),
      statusLabel: normalizeStatusLabel(raw['ステータス']),
      priorityLabel: null,
      assigneeName: cleanPersonName(asString(raw['担当者'])),
      requesterName: cleanPersonName(asString(raw['依頼者'])),
      requestingDeptName: asString(raw['依頼部署']),
      deadline: asIsoDate(raw['期限']),
      plannedCompletionDate: asIsoDate(raw['完了予定日']),
    };
  };

/** 対象シートを順に読んで NormalizedTaskRow[] にまとめる */
export const collectNormalizedRows = (workbook: XLSX.WorkBook): NormalizedTaskRow[] => {
  const out: NormalizedTaskRow[] = [];

  type Handler = (raw: Record<string, unknown>) => NormalizedTaskRow | null;
  const handlers: { sheet: string; fn: Handler }[] = [
    { sheet: 'システム改修対応一覧', fn: normalizeKaishuRow },
    {
      sheet: '改修要望対応状況',
      fn: normalizeRequestRow('改修要望対応状況'),
    },
    {
      sheet: '■安定期 最優先タスク',
      fn: normalizeRequestRow('■安定期 最優先タスク'),
    },
  ];

  for (const { sheet, fn } of handlers) {
    if (!workbook.SheetNames.includes(sheet)) continue;
    for (const raw of sheetToJson(workbook, sheet)) {
      const row = fn(raw);
      if (row) out.push(row);
    }
  }

  return out;
};
