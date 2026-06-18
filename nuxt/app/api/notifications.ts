import type { AppNotification, NotificationPreference } from '~/types/notification';

/** GET /api/notifications — 自分宛の通知（新着順） */
export const apiListNotifications = (
  api: typeof $fetch,
  limit?: number,
): Promise<AppNotification[]> =>
  api<AppNotification[]>(`/notifications${limit ? `?limit=${limit}` : ''}`);

/** GET /api/notifications/unread-count */
export const apiNotificationUnreadCount = async (api: typeof $fetch): Promise<number> => {
  const res = await api<{ count: number }>('/notifications/unread-count');
  return res.count;
};

/** PATCH /api/notifications/:id/read */
export const apiMarkNotificationRead = async (api: typeof $fetch, id: string): Promise<void> => {
  await api(`/notifications/${id}/read`, { method: 'PATCH' });
};

/** POST /api/notifications/read-all */
export const apiMarkAllNotificationsRead = async (api: typeof $fetch): Promise<void> => {
  await api('/notifications/read-all', { method: 'POST' });
};

/** GET /api/notifications/preferences */
export const apiGetNotificationPreferences = (
  api: typeof $fetch,
): Promise<NotificationPreference[]> => api<NotificationPreference[]>('/notifications/preferences');

/** PATCH /api/notifications/preferences — 1 タイプ更新し全件返す */
export const apiSetNotificationPreference = (
  api: typeof $fetch,
  type: string,
  enabled: boolean,
): Promise<NotificationPreference[]> =>
  api<NotificationPreference[]>('/notifications/preferences', {
    method: 'PATCH',
    body: { type, enabled },
  });
