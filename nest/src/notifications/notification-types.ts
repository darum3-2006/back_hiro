/**
 * 通知タイプの登録表。**タイプを増やすときはここに 1 エントリ足すだけ**。
 * - 設定画面（マイページ通知タブ）のラベルと既定値の単一ソース
 * - 生成側は key で通知を作り、受信候補者ごとに preference を見て配信する
 */
export const NOTIFICATION_TYPES = [
  {
    key: 'task_created',
    label: '新しいタスクが登録されたとき',
    defaultEnabled: true,
  },
  {
    key: 'assigned',
    label: '自分が担当に設定されたとき',
    defaultEnabled: true,
  },
  {
    key: 'status_changed',
    label: '担当 / 起票したタスクのステータスが変わったとき',
    defaultEnabled: true,
  },
  {
    key: 'mentioned',
    label: 'コメントで自分が @メンションされたとき',
    defaultEnabled: true,
  },
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['key'];

const TYPE_MAP = new Map(NOTIFICATION_TYPES.map((t) => [t.key as string, t]));

/** 既知の通知タイプか */
export const isNotificationType = (key: string): key is NotificationType => TYPE_MAP.has(key);

/** 既定の有効/無効（未設定ユーザーの初期値）。未知タイプは true 扱い。 */
export const defaultEnabledFor = (key: string): boolean =>
  TYPE_MAP.get(key)?.defaultEnabled ?? true;
