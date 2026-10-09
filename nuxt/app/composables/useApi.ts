import type { FetchError } from 'ofetch';
import { apiRefresh } from '~/api/auth';
import { rateLimitText, rateLimitToast, retryAfterSecondsOf } from '~/utils/rate-limit';

/**
 * リフレッシュの結果。
 * - ok: 再発行できた
 * - failed: リフレッシュトークンが無効 → ログイン画面へ
 * - rate-limited: リフレッシュ自体が 429。トークンは無効ではないのでログアウトさせない
 */
type RefreshResult = { kind: 'ok' } | { kind: 'failed' } | { kind: 'rate-limited'; error: unknown };

/**
 * リフレッシュの単一飛行（single-flight）。
 * 401 が同時多発しても /auth/refresh は 1 回だけ叩き、全員がその結果を待つ
 * （リフレッシュトークンはローテーションするため、並列に叩くと再利用扱いになる）。
 */
let refreshInFlight: Promise<RefreshResult> | null = null;

const statusOf = (e: unknown): number | undefined =>
  (e as FetchError).response?.status ?? (e as FetchError).statusCode;

const refreshAccessToken = (token: Ref<string | null>): Promise<RefreshResult> => {
  refreshInFlight ??= apiRefresh()
    .then((res): RefreshResult => {
      token.value = res.accessToken;
      return { kind: 'ok' };
    })
    .catch(
      (e: unknown): RefreshResult =>
        statusOf(e) === 429 ? { kind: 'rate-limited', error: e } : { kind: 'failed' },
    )
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};

/**
 * Authorization ヘッダ付きの $fetch ラッパー。
 * 401 を受けたらリフレッシュトークンでアクセストークンを再発行して 1 回だけリトライし、
 * それでもダメならトークンを破棄してログイン画面へ戻す。
 *
 * アプリは ssr:false （CSR のみ）なので相対パスで OK。
 */
export const useApi = () => {
  const token = useAuthToken();
  // await をまたぐと Nuxt のコンテキストが外れるので、呼び出し時（setup 中）に取っておく
  const toast = useToast();

  const base = $fetch.create({
    baseURL: '/api',
    onRequest({ options }) {
      const headers = new Headers(options.headers as HeadersInit | undefined);
      if (token.value) headers.set('Authorization', `Bearer ${token.value}`);
      // SSE のデータ更新イベントで自タブ発の変更を識別するためのタブ ID
      headers.set('X-Client-Id', CLIENT_ID);
      options.headers = headers;
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

  /**
   * レート制限（429）: 解除見込み時刻つきのトーストを 1 枚だけ出す（同じ id で上書き）。
   * 401 → リフレッシュ自体が 429 の場合も、トークンは無効ではないのでログアウトさせずにこれを出す。
   * 各画面が `e.data.message` をそのまま出しても英語の ThrottlerException が見えないよう、
   * レスポンス本文の message も同じ文言に差し替える（data は response._data の getter）。
   */
  const handleRateLimited = (e: unknown) => {
    const { title, description } = rateLimitText(retryAfterSecondsOf(e));
    toast.add(rateLimitToast(e));
    const body = (e as FetchError).response?._data as unknown;
    if (body && typeof body === 'object') {
      (body as { message?: string }).message = `${title}。${description}`;
    }
  };

  const request = async (input: string, options?: Record<string, unknown>) => {
    try {
      return await base(input, options);
    } catch (e) {
      if (statusOf(e) === 429) handleRateLimited(e);
      if (statusOf(e) !== 401) throw e;
      // アクセストークン失効の可能性 → リフレッシュして 1 回だけリトライ
      const refreshed = await refreshAccessToken(token);
      if (refreshed.kind === 'rate-limited') {
        handleRateLimited(refreshed.error);
        throw refreshed.error;
      }
      if (refreshed.kind === 'ok') {
        try {
          return await base(input, options);
        } catch (e2) {
          if (statusOf(e2) === 429) handleRateLimited(e2);
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
