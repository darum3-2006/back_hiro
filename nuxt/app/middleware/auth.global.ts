/**
 * 認証ミドルウェア。
 * - / は対象外（ここはトップで振り分けのみ）。
 * - /[tenantKey]/login は対象外。
 * - それ以外で未ログインなら、URL の tenantKey を使ってログイン画面へ。
 * - 初回アクセス時にトークンがあれば /auth/me を叩いて me を復元。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const tenantKey = (to.params.tenantKey as string | undefined) ?? '';

  if (to.path === '/') return;
  if (tenantKey && to.path === `/${tenantKey}/login`) return;

  const { token, me, fetchMe } = useAuth();

  if (!token.value) {
    if (tenantKey) return navigateTo(`/${tenantKey}/login`, { replace: true });
    return navigateTo('/', { replace: true });
  }

  if (!me.value) {
    const data = await fetchMe();
    if (!data) {
      if (tenantKey) return navigateTo(`/${tenantKey}/login`, { replace: true });
      return navigateTo('/', { replace: true });
    }
  }
});
