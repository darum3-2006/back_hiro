/** 既定で先頭に出す件数。これを超えた分は「他 N 件」に畳む。 */
const DEFAULT_HEAD_COUNT = 2;

/**
 * 名前の配列を「A, B 他 N 件」の 1 行に畳む。
 * プロジェクト数が増えても一覧の列やボタンの幅が破綻しないようにするためのもの。
 * 全件は `title` 属性などに `namesTitle` で別途出す想定。
 */
export const summarizeNames = (names: string[], headCount = DEFAULT_HEAD_COUNT): string => {
  const rest = names.length - headCount;
  if (rest <= 0) return names.join(', ');
  return `${names.slice(0, headCount).join(', ')} 他 ${rest} 件`;
};

/** ホバー時に全件を見せるための title 用文字列（1 行 1 件）。 */
export const namesTitle = (names: string[]): string => names.join('\n');
