/**
 * Authorization ヘッダ付きの $fetch ラッパー。
 * 401 を受けたらトークンを破棄してログイン画面へ戻す。
 */
export const useApi = () => {
  const token = useAuthToken();

  return $fetch.create({
    baseURL: '/api',
    onRequest({ options }) {
      if (token.value) {
        const headers = new Headers(options.headers as HeadersInit | undefined);
        headers.set('Authorization', `Bearer ${token.value}`);
        options.headers = headers;
      }
    },
    async onResponseError({ response }) {
      if (response.status !== 401) return;
      token.value = null;
      if (!import.meta.client) return;
      const path = window.location.pathname;
      const m = /^\/([^/]+)/.exec(path);
      const tenantKey = m?.[1] ?? '';
      const loginPath = tenantKey ? `/${tenantKey}/login` : '/';
      if (path !== loginPath) {
        await navigateTo(loginPath, { replace: true });
      }
    },
  });
};
