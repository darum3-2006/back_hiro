import type { AuthMe, GoogleLoginInput, LoginInput } from '~/types/auth';
import { apiFetchMe, apiLogin, apiLoginWithGoogle } from '~/api/auth';

/** JWT アクセストークン。Cookie で SSR/CSR 両対応。 */
export const useAuthToken = () =>
  useCookie<string | null>('auth_token', {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

/** 現在ログイン中ユーザー（未ログインなら null）。 */
export const useAuthMe = () => useState<AuthMe | null>('auth-me', () => null);

export const useAuth = () => {
  const token = useAuthToken();
  const me = useAuthMe();
  const api = useApi();

  const isAuthenticated = computed(() => Boolean(token.value && me.value));

  const login = async (input: LoginInput) => {
    const res = await apiLogin($fetch.create({ baseURL: '/api' }), input);
    token.value = res.accessToken;
    me.value = { ...res.user, tenant: res.tenant };
    return res;
  };

  const loginWithGoogle = async (input: GoogleLoginInput) => {
    const res = await apiLoginWithGoogle($fetch.create({ baseURL: '/api' }), input);
    token.value = res.accessToken;
    me.value = { ...res.user, tenant: res.tenant };
    return res;
  };

  const fetchMe = async (): Promise<AuthMe | null> => {
    if (!token.value) {
      me.value = null;
      return null;
    }
    try {
      const data = await apiFetchMe(api);
      me.value = data;
      return data;
    } catch {
      me.value = null;
      return null;
    }
  };

  const logout = async (redirectToLogin = true) => {
    const tenantKey = me.value?.tenant.key;
    token.value = null;
    me.value = null;
    if (redirectToLogin && import.meta.client) {
      // クッキー削除を確実に反映させるためフルリロード
      window.location.href = tenantKey ? `/${tenantKey}/login` : '/';
    }
  };

  return { token, me, isAuthenticated, login, loginWithGoogle, fetchMe, logout };
};
