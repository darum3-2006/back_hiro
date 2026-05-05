/**
 * URL の :tenantKey パラメータを取り出す。
 * 未認証画面（ログイン等）が tenantKey 配下にない場合は空文字。
 */
export const useCurrentTenantKey = () => {
  const route = useRoute();
  return computed(() => (route.params.tenantKey as string | undefined) ?? '');
};
