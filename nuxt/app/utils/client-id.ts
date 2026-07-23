/**
 * このタブ（JS 実行コンテキスト）を識別する ID。モジュールスコープなのでタブごとに 1 つ。
 * SSE のデータ更新イベントで「自分のタブ発の変更か」を判定するのに使う
 * （同一ユーザーの別タブには反映させたいので、ユーザー ID での判定では不十分）。
 */
export const CLIENT_ID = globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2);
