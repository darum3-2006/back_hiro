import { apiGetMySettings, apiUpdateMySettings } from '~/api/user-settings';
import type { UpdateUserSettingsInput, UserSettings } from '~/types/user-settings';

/** サーバ既定と同じ値。取得前でも画面が既定で描けるようにフロント側にも置く */
const DEFAULT_SETTINGS: UserSettings = {
  dashboard: { dateField: 'deadline', dueSoonDays: 7, inactiveDays: 7 },
};

/**
 * ログインユーザーの画面設定。端末をまたいで引き継ぐためサーバに置いている。
 * 取得前は既定値を返すので、呼び出し側でローディング分岐を持たなくてよい。
 */
export const useMySettings = () => {
  const api = useApi();
  const { data, refresh } = useAsyncData('my-settings', () => apiGetMySettings(api), {
    default: () => DEFAULT_SETTINGS,
  });

  /** 変更はサーバ応答で上書きする（マージ結果が正本なので楽観更新はしない） */
  const update = async (input: UpdateUserSettingsInput) => {
    data.value = await apiUpdateMySettings(api, input);
  };

  return { settings: data, update, refresh };
};
