import type { FetchError } from 'ofetch';
import { apiRefresh } from '~/api/auth';

/**
 * リフレッシュの単一飛行（single-flight）。
 * 401 が同時多発しても /auth/refresh は 1 回だけ叩き、全員がその結果を待つ
 * （リフレッシュトークンはローテーションするため、並列に叩くと再利用扱いになる）。
 */
let refreshInFlight: Promise<boolean> | null = null;

const refreshAccessToken = (token: Ref<string | null>): Promise<boolean> => {
  refreshInFlight ??= apiRefresh()
    .then((res) => {
      token.value = res.accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};

const statusOf = (e: unknown): number | undefined =>
  (e as FetchError).response?.status ?? (e as FetchError).statusCode;

/**
 * Authorization ヘッダ付きの $fetch ラッパー。
 * 401 を受けたらリフレッシュトークンでアクセストークンを再発行して 1 回だけリトライし、
 * それでもダメならトークンを破棄してログイン画面へ戻す。
 *
 * アプリは ssr:false （CSR のみ）なので相対パスで OK。
 */
export const useApi = () => {
  const token = useAuthToken();

  const base = $fetch.create({
    baseURL: '/api',
    onRequest({ options }) {
      if (token.value) {
        const headers = new Headers(options.headers as HeadersInit | undefined);
        headers.set('Authorization', `Bearer ${token.value}`);
        options.headers = headers;
      }
    },
  });

  /** リフレッシュも失敗した最終 401: トークンを破棄してログイン画面へ */
  const handleUnauthorized = async () => {
    token.value = null;
    const path = window.location.pathname;
    const m = /^\/([^/]+)/.exec(path);
    const tenantKey = m?.[1] ?? '';
    const loginPath = tenantKey ? `/${tenantKey}/login` : '/';
    if (path === loginPath) return;
    // 再ログイン後に元のページへ戻せるよう、現在の fullPath を redirect クエリで保持する。
    const fullPath = path + window.location.search;
    const target =
      tenantKey && fullPath.startsWith(`/${tenantKey}/`) && fullPath !== loginPath
        ? `${loginPath}?redirect=${encodeURIComponent(fullPath)}`
        : loginPath;
    await navigateTo(target, { replace: true });
  };

  const request = async (input: string, options?: Record<string, unknown>) => {
    try {
      return await base(input, options);
    } catch (e) {
      if (statusOf(e) !== 401) throw e;
      // アクセストークン失効の可能性 → リフレッシュして 1 回だけリトライ
      if (await refreshAccessToken(token)) {
        try {
          return await base(input, options);
        } catch (e2) {
          if (statusOf(e2) === 401) await handleUnauthorized();
          throw e2;
        }
      }
      await handleUnauthorized();
      throw e;
    }
  };

  // 既存の呼び出し側は `api<T>(url, opts)` の形でしか使わないため、
  // 関数ラッパーを $fetch 互換として扱う（.raw / .create は未使用）。
  return request as unknown as typeof $fetch;
};
