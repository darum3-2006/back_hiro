import { apiListMyTaskViews } from '~/api/task-views';

/**
 * 自分の閲覧履歴（プロジェクト横断）。メニューを開いたときに取り直す前提なので
 * 初回は取りに行かない（immediate: false）。
 */
export const useMyTaskViews = () => {
  const api = useApi();
  return useAsyncData('my-task-views', () => apiListMyTaskViews(api), {
    default: () => [],
    immediate: false,
  });
};
