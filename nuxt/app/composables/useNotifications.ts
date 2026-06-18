import dayjs from 'dayjs';
import {
  apiListNotifications,
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
  apiNotificationUnreadCount,
} from '~/api/notifications';
import type { AppNotification } from '~/types/notification';

// SSE 接続はアプリで 1 本。モジュールスコープで保持して多重接続を防ぐ。
let eventSource: EventSource | null = null;

/**
 * アプリ内通知。状態は useState で全コンポーネント共有。
 * REST を正本（一覧/未読数/既読化）とし、SSE で新着を push 受信して未読バッジを更新する。
 */
export const useNotifications = () => {
  const api = useApi();
  const token = useAuthToken();
  const items = useState<AppNotification[]>('notifications:items', () => []);
  const unread = useState<number>('notifications:unread', () => 0);

  const refresh = async () => {
    const [list, count] = await Promise.all([
      apiListNotifications(api),
      apiNotificationUnreadCount(api),
    ]);
    items.value = list;
    unread.value = count;
  };

  const markRead = async (id: string) => {
    const n = items.value.find((i) => i.id === id);
    if (!n || n.readAt) return;
    await apiMarkNotificationRead(api, id);
    n.readAt = dayjs().toISOString();
    unread.value = Math.max(0, unread.value - 1);
  };

  const markAllRead = async () => {
    await apiMarkAllNotificationsRead(api);
    const now = dayjs().toISOString();
    items.value = items.value.map((i) => ({ ...i, readAt: i.readAt ?? now }));
    unread.value = 0;
  };

  /** SSE 購読を開始（クライアントのみ・多重接続防止）。新着が来たら一覧先頭へ追加し未読+1。 */
  const connect = () => {
    if (!import.meta.client || eventSource || !token.value) return;
    eventSource = new EventSource(
      `/api/notifications/stream?token=${encodeURIComponent(token.value)}`,
    );
    eventSource.onmessage = (ev) => {
      try {
        const n = JSON.parse(ev.data) as AppNotification;
        if (items.value.some((i) => i.id === n.id)) return;
        items.value = [n, ...items.value];
        if (!n.readAt) unread.value += 1;
      } catch {
        // 不正なペイロードは無視（ping 等は別イベントなのでここには来ない）
      }
    };
    // onerror 時は EventSource が自動再接続するため、ここでは何もしない
  };

  const disconnect = () => {
    eventSource?.close();
    eventSource = null;
  };

  return { items, unread, refresh, markRead, markAllRead, connect, disconnect };
};
