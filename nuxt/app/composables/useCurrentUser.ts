/**
 * 現在ログイン中ユーザーの id を返す computed。未ログインなら null。
 */
export const useCurrentUserId = () => {
  const { me } = useAuth();
  return computed<string | null>(() => me.value?.id ?? null);
};
