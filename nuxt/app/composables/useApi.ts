/**
 * Authorization ヘッダ付きの $fetch ラッパー。
 * 401 を受けたらトークンを破棄してログイン画面へ戻す。
 *
 * アプリは ssr:false （CSR のみ）なので相対パスで OK。
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
    },
  });
};
