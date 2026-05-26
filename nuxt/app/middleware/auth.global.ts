/**
 * 認証ミドルウェア。
 * - / は対象外（ここはトップで振り分けのみ）。
 * - /[tenantKey]/login は対象外。
 * - それ以外で未ログインなら、URL の tenantKey を使ってログイン画面へ。
 * - 初回アクセス時にトークンがあれば /auth/me を叩いて me を復元。
 * - URL の tenantKey とログイン中ユーザーの所属テナントが一致しない場合は、
 *   自分のテナントトップへリダイレクトする。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const tenantKey = (to.params.tenantKey as string | undefined) ?? '';

  if (to.path === '/') return;
  if (tenantKey && to.path === `/${tenantKey}/login`) return;

  const { token, me, fetchMe } = useAuth();

  // 再ログイン後に元の URL に戻せるよう、login へ飛ばす際は redirect クエリで fullPath を保持する。
  const loginUrlFor = (key: string) => `/${key}/login?redirect=${encodeURIComponent(to.fullPath)}`;

  if (!token.value) {
    if (tenantKey) return navigateTo(loginUrlFor(tenantKey), { replace: true });
    return navigateTo('/', { replace: true });
  }

  if (!me.value) {
    const data = await fetchMe();
    if (!data) {
      if (tenantKey) return navigateTo(loginUrlFor(tenantKey), { replace: true });
      return navigateTo('/', { replace: true });
    }
  }

  // URL のテナントキーとログイン中ユーザーのテナントが一致しない場合は弾く。
  const myTenantKey = me.value?.tenant.key;
  if (tenantKey && myTenantKey && tenantKey !== myTenantKey) {
    return navigateTo(`/${myTenantKey}`, { replace: true });
  }
});
