import type { UpdateUserSettingsInput, UserSettings } from '~/types/user-settings';

/** GET /api/me/settings — 未設定の画面には既定値が入った状態で返る */
export const apiGetMySettings = (api: typeof $fetch): Promise<UserSettings> =>
  api<UserSettings>('/me/settings');

/** PATCH /api/me/settings — 画面ごとの名前空間単位でマージされる */
export const apiUpdateMySettings = (
  api: typeof $fetch,
  input: UpdateUserSettingsInput,
): Promise<UserSettings> => api<UserSettings>('/me/settings', { method: 'PATCH', body: input });
