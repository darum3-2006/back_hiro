export interface ApiKeyInfo {
  issued: boolean;
  prefix?: string | null;
  createdAt?: string | null;
}

export interface ApiKeyIssued {
  /** 平文キー。発行レスポンスでのみ返る（以後は再表示不可）。 */
  apiKey: string;
  prefix: string;
}

/** GET /api/users/me/api-key — 現在のキー情報（平文は返らない）。 */
export const apiGetApiKey = (api: typeof $fetch): Promise<ApiKeyInfo> =>
  api<ApiKeyInfo>('/users/me/api-key');

/** POST /api/users/me/api-key — キーを発行/再生成（平文を1回だけ返す）。 */
export const apiRegenerateApiKey = (api: typeof $fetch): Promise<ApiKeyIssued> =>
  api<ApiKeyIssued>('/users/me/api-key', { method: 'POST' });

/** DELETE /api/users/me/api-key — キーを失効。 */
export const apiRevokeApiKey = async (api: typeof $fetch): Promise<void> => {
  await api('/users/me/api-key', { method: 'DELETE' });
};
