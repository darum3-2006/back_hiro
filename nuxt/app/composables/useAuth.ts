import type { AuthMe, GoogleLoginInput, LoginInput } from '~/types/auth';
import { apiFetchMe, apiLogin, apiLoginWithGoogle, apiLogout } from '~/api/auth';

/** JWT アクセストークン。Cookie で SSR/CSR 両対応。 */
export const useAuthToken = () =>
  useCookie<string | null>('auth_token', {
    sameSite: 'lax',
    path: '/',
    // 本番（HTTPS）では Secure を付け、平文 HTTP への送出を防ぐ。
    // dev は localhost の HTTP で動かすため除外する。
    secure: !import.meta.dev,
    // JWT 既定の有効期限（1d）に合わせる。期限切れトークンを長く保持しない。
    maxAge: 60 * 60 * 24,
  });

/** 現在ログイン中ユーザー（未ログインなら null）。 */
export const useAuthMe = () => useState<AuthMe | null>('auth-me', () => null);

export const useAuth = () => {
  const token = useAuthToken();
  const me = useAuthMe();
  const api = useApi();

  const isAuthenticated = computed(() => Boolean(token.value && me.value));

  /** 閲覧のみ（readonly）ユーザーか。true なら編集系 UI を出さない。 */
  const isReadonly = computed(() => me.value?.role === 'readonly');

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
    // リフレッシュトークンをサーバ側で失効（ベストエフォート。失敗してもログアウトは続行）
    await apiLogout().catch(() => {});
    token.value = null;
    me.value = null;
    if (redirectToLogin && import.meta.client) {
      // クッキー削除を確実に反映させるためフルリロード
      window.location.href = tenantKey ? `/${tenantKey}/login` : '/';
    }
  };

  return { token, me, isAuthenticated, isReadonly, login, loginWithGoogle, fetchMe, logout };
};
