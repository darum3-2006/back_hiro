import type { AuthMe, LoginInput, LoginResponse } from '~/types/auth';

/** POST /api/auth/login */
export const apiLogin = async (
  api: typeof $fetch,
  input: LoginInput,
): Promise<LoginResponse> => {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input,
  });
};

/** GET /api/auth/me */
export const apiFetchMe = async (api: typeof $fetch): Promise<AuthMe> => {
  return api<AuthMe>('/auth/me');
};
