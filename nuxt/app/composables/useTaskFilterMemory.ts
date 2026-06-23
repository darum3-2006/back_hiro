import { FILTER_QUERY_KEYS } from '~/composables/useTaskFilters';

const storageKeyFor = (projectId: string) => `tasks:filters:${projectId}`;

/**
 * 保存済みのフィルタ（URL クエリ部分集合）を読み出す。
 * - null: 一度も保存されていない（記憶なし）
 * - {}: クリア済み（フィルタ無しを明示的に記憶）
 */
export const readSavedTaskFilters = (projectId: string): Record<string, string> | null => {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(storageKeyFor(projectId));
    if (raw === null) return null;
    const saved = JSON.parse(raw) as unknown;
    return saved && typeof saved === 'object' ? (saved as Record<string, string>) : null;
  } catch {
    return null;
  }
};

/**
 * タスクのフィルタを画面間（一覧 / ボード / ガント）で共有・記憶する。
 * フィルタは URL クエリで表現されるため、route.query のフィルタ部分をプロジェクトごとに
 * localStorage へ保存し、URL に何も無い「素の遷移」で開いたときに復元する。
 *
 * - 保存は常に行う。
 * - 自動復元（onMounted）は autoRestore=true のときだけ。一覧ページは独自の復元
 *   （SavedView と協調）を行うため false で呼び、保存だけ利用する。
 *
 * ⚠️ ライフサイクル登録の都合上、各ページ setup の **先頭（await より前）** で呼ぶこと。
 */
export const useTaskFilterMemory = (options: { autoRestore?: boolean } = {}) => {
  const { autoRestore = true } = options;
  const route = useRoute();
  const router = useRouter();
  const projectId = useCurrentProjectId();

  const storageKey = computed(() => storageKeyFor(projectId.value));

  const snapshot = (): Record<string, string> => {
    const snap: Record<string, string> = {};
    for (const k of FILTER_QUERY_KEYS) {
      const v = route.query[k];
      if (typeof v === 'string' && v) snap[k] = v;
    }
    return snap;
  };

  // フィルタ変更のたびに保存（クリア時は空オブジェクト＝記憶もクリア）
  watch(
    snapshot,
    (snap) => {
      if (!import.meta.client) return;
      try {
        localStorage.setItem(storageKey.value, JSON.stringify(snap));
      } catch {
        // ignore（プライベートモード等）
      }
    },
    { deep: true },
  );

  // URL にフィルタ / ビュー / 列状態が無い「素の遷移」のときだけ、記憶したフィルタを復元
  onMounted(() => {
    if (!autoRestore) return;
    const hasUrlState =
      FILTER_QUERY_KEYS.some((k) => route.query[k]) ||
      ['view', 'cols', 'colw', 'sort', 'sortDir'].some((k) => route.query[k]);
    if (hasUrlState) return;
    const saved = readSavedTaskFilters(projectId.value);
    if (saved && Object.keys(saved).length > 0) {
      void router.replace({ query: { ...route.query, ...saved } });
    }
  });
};
