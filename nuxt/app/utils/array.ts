/**
 * 同じ順序で同じ要素が並んでいるかを判定する。
 * URL クエリとの差分検出（フィルタ値・列順）に使うので、順序の違いは「差分あり」扱い。
 */
export const arraysEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);
