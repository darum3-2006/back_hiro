import dayjs from 'dayjs';

/**
 * タスク内の日付列が「今日より前」かつ「完了系ステータスでない」を判定する共通関数。
 *
 * - 期限超過 (deadline)、完了予定日超過 (plannedCompletionDate) など
 *   タスク詳細スライドオーバーと一覧でルールを共有するためのヘルパ。
 * - date が null/undefined のときは常に false
 * - statusMap に statusCode の項目が無いときは isTerminal を判定不能とみなし、
 *   念のため超過と扱わず false を返す
 */
export const isTaskDatePast = (
  date: string | null | undefined,
  statusCode: string,
  statusMap: Record<string, { isTerminal: boolean } | undefined>,
): boolean => {
  if (!date) return false;
  if (statusMap[statusCode]?.isTerminal) return false;
  return dayjs(date).isBefore(dayjs(), 'day');
};
