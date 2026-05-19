import type { AuthMe, ChangePasswordInput, LoginInput, LoginResponse } from '~/types/auth';

/** POST /api/auth/login */
export const apiLogin = async (api: typeof $fetch, input: LoginInput): Promise<LoginResponse> => {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input,
  });
};

/** GET /api/auth/me */
export const apiFetchMe = async (api: typeof $fetch): Promise<AuthMe> => {
  return api<AuthMe>('/auth/me');
};

/** PATCH /api/auth/password — 本人のパスワード変更 */
export const apiChangePassword = async (
  api: typeof $fetch,
  input: ChangePasswordInput,
): Promise<void> => {
  await api('/auth/password', { method: 'PATCH', body: input });
};
