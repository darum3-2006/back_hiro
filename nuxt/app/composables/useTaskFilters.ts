import type { DateRangeValue } from '~/components/DateRangeFilter.vue';
import type { Flag, Tag, TaskPriority, TaskStatus } from '~/types/master';
import type { Member } from '~/types/member';
import type { Task } from '~/types/task';
import { fmtDate } from '~/utils/date';

/** 「担当者なし」を表す sentinel（実 ID と衝突しない値） */
export const NO_ASSIGNEE = '__none__';

interface TaskFilterData {
  tasks: Ref<Task[]>;
  statuses: Ref<TaskStatus[]>;
  priorities: Ref<TaskPriority[]>;
  members: Ref<Member[]>;
  tags: Ref<Tag[]>;
  flags: Ref<Flag[]>;
}

/**
 * タスク一覧 / ボード / ガント 共通のフィルタ。状態は URL クエリで同期し、
 * `filteredTasks` に絞り込み結果を返す。UI バインドに必要な ref / items / chips も公開する。
 *
 * 3 画面ともフィルタの実装はここが唯一の正本。クエリキーは `FILTER_QUERY_KEYS`
 * （`useTaskFilterMemory` の記憶対象・SavedView の保存対象と共有）と
 * `FILTER_ARRAY_KEYS` から導出しており、画面側に写しを持たせない。
 */
/** フィルタとして扱う URL クエリキー一覧（永続化・共有の対象） */
export const FILTER_QUERY_KEYS = [
  'search',
  'status',
  'priority',
  'assignee',
  'tag',
  'tagNot',
  'flag',
  'flagNot',
  'showCompleted',
  'deadlineFrom',
  'deadlineTo',
  'plannedStartFrom',
  'plannedStartTo',
  'plannedCompletionFrom',
  'plannedCompletionTo',
  'plannedReleaseFrom',
  'plannedReleaseTo',
  'completedAtFrom',
  'completedAtTo',
  'statusChangedFrom',
  'statusChangedTo',
  'createdFrom',
  'createdTo',
  'updatedFrom',
  'updatedTo',
];

/**
 * 配列値フィルタのクエリキー。`tagNot` / `flagNot`（除外）も独立したキーとして持つ。
 * UI バインド用 ref・applied 用 ref・URL 同期の 3 者がこの 1 本を回ることで、
 * フィルタ追加時に片方だけ直して board と一覧で挙動が食い違う事故を防ぐ。
 */
export const FILTER_ARRAY_KEYS = [
  'status',
  'priority',
  'assignee',
  'tag',
  'tagNot',
  'flag',
  'flagNot',
] as const;

export type FilterArrayKey = (typeof FILTER_ARRAY_KEYS)[number];

export const useTaskFilters = (data: TaskFilterData) => {
  const route = useRoute();
  const router = useRouter();
  const { tasks, statuses, priorities, members, tags, flags } = data;

  const statusMap = computed(() => Object.fromEntries(statuses.value.map((s) => [s.code, s])));

  const updateQuery = (changes: Record<string, string | undefined>) => {
    const merged = { ...route.query, ...changes };
    const cleaned = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined && v !== ''),
    );
    router.replace({ query: cleaned });
  };

  const queryString = (key: string): string => (route.query[key] as string | undefined) ?? '';

  // カンマ区切りで配列を URL に同期。旧形式 `?status=foo` (単値) も
  // [foo] として読めるので後方互換あり。
  const queryArray = (key: string): string[] => {
    const v = queryString(key);
    if (!v) return [];
    return v.split(',').filter(Boolean);
  };

  const search = computed<string>({
    get: () => queryString('search'),
    set: (v) => updateQuery({ search: v || undefined }),
  });

  // UI バインド用の ref と、描画に使う applied 用 ref を分け、applied は rAF で 1 フレーム遅延。
  type FilterRefs = Record<FilterArrayKey, Ref<string[]>>;
  const mkFilterRefs = (init: (key: FilterArrayKey) => string[]): FilterRefs =>
    Object.fromEntries(FILTER_ARRAY_KEYS.map((k) => [k, ref<string[]>(init(k))])) as FilterRefs;

  /** UI バインド用（v-model 先）。クリック直後にチェックが反映される即時更新側。 */
  const uiFilters = mkFilterRefs((k) => queryArray(k));
  /** 描画に使う側。rAF で 1 フレーム遅らせ、重いテーブル再描画を後回しにする。 */
  const applied = mkFilterRefs((k) => [...uiFilters[k].value]);

  let pendingFrame: number | null = null;
  const scheduleApply = () => {
    if (!import.meta.client) return;
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        for (const key of FILTER_ARRAY_KEYS) {
          const ui = uiFilters[key].value;
          if (!arraysEqual(applied[key].value, ui)) applied[key].value = [...ui];
        }
        syncFiltersToUrl();
      });
    });
  };

  // 1回の操作で複数キーが変わり得る（例: 含む→除外の切替は tag と tagNot の両方）。
  // router.replace は非同期で route.query の反映が遅れるため、キーごとに replace すると
  // 後の replace が古い query を土台にして前の変更を巻き戻す。必ず 1 回にまとめる。
  const syncFiltersToUrl = () => {
    const changes: Record<string, string | undefined> = {};
    for (const key of FILTER_ARRAY_KEYS) {
      const arr = uiFilters[key].value;
      if (!arraysEqual(arr, queryArray(key))) {
        changes[key] = arr.length > 0 ? arr.join(',') : undefined;
      }
    }
    if (Object.keys(changes).length > 0) updateQuery(changes);
  };

  watch(Object.values(uiFilters), () => scheduleApply(), { deep: true });

  // 戻る/進む・ディープリンク等で URL が外から変わったら ref を合わせる
  for (const key of FILTER_ARRAY_KEYS) {
    watch(
      () => queryArray(key),
      (v) => {
        if (arraysEqual(v, uiFilters[key].value)) return;
        uiFilters[key].value = v;
        // URL 主導で来たので applied も即時同期
        applied[key].value = [...v];
      },
      { deep: true },
    );
  }

  // 既存 UI（TaskFilterBar / 一覧の列ヘッダ）が名前で受け取れるようにしたエイリアス。
  // 実体は uiFilters の ref と同一。
  const {
    status: statusFilter,
    priority: priorityFilter,
    assignee: assigneeFilter,
    tag: tagFilter,
    tagNot: tagNotFilter,
    flag: flagFilter,
    flagNot: flagNotFilter,
  } = uiFilters;

  // ===== 日付範囲フィルタ =====
  const useDateRangeFilter = (queryKeyFrom: string, queryKeyTo: string) => {
    const range = ref<DateRangeValue>({
      from: queryString(queryKeyFrom) || null,
      to: queryString(queryKeyTo) || null,
    });

    const isActive = computed(() => Boolean(range.value.from || range.value.to));

    watch(
      range,
      (v) => {
        const currentFrom = queryString(queryKeyFrom) || null;
        const currentTo = queryString(queryKeyTo) || null;
        if (v.from === currentFrom && v.to === currentTo) return;
        updateQuery({ [queryKeyFrom]: v.from ?? undefined, [queryKeyTo]: v.to ?? undefined });
      },
      { deep: true },
    );

    watch(
      () => [queryString(queryKeyFrom), queryString(queryKeyTo)] as const,
      ([from, to]) => {
        const fromN = from || null;
        const toN = to || null;
        if (range.value.from === fromN && range.value.to === toN) return;
        range.value = { from: fromN, to: toN };
      },
    );

    const clear = () => {
      range.value = { from: null, to: null };
    };

    return { range, isActive, clear };
  };

  const deadlineFilter = useDateRangeFilter('deadlineFrom', 'deadlineTo');
  const plannedStartFilter = useDateRangeFilter('plannedStartFrom', 'plannedStartTo');
  const plannedCompletionFilter = useDateRangeFilter(
    'plannedCompletionFrom',
    'plannedCompletionTo',
  );
  const plannedReleaseFilter = useDateRangeFilter('plannedReleaseFrom', 'plannedReleaseTo');
  const completedAtFilter = useDateRangeFilter('completedAtFrom', 'completedAtTo');
  const statusChangedAtFilter = useDateRangeFilter('statusChangedFrom', 'statusChangedTo');
  const createdAtFilter = useDateRangeFilter('createdFrom', 'createdTo');
  const updatedAtFilter = useDateRangeFilter('updatedFrom', 'updatedTo');

  /** 日付範囲フィルタをキー引きでまとめたもの。チップ / 設定 UI / 列ヘッダの単一の出所。 */
  const dateFilters = {
    deadline: deadlineFilter,
    plannedStart: plannedStartFilter,
    plannedCompletion: plannedCompletionFilter,
    plannedRelease: plannedReleaseFilter,
    completedAt: completedAtFilter,
    statusChangedAt: statusChangedAtFilter,
    createdAt: createdAtFilter,
    updatedAt: updatedAtFilter,
  };

  /** 日付範囲フィルタの表示名。チップと設定 UI で共用する。 */
  const DATE_FILTER_LABELS: Record<keyof typeof dateFilters, string> = {
    deadline: '期限',
    plannedStart: '着手予定日',
    plannedCompletion: '完了予定日',
    plannedRelease: 'リリース予定日',
    completedAt: '完了日時',
    statusChangedAt: 'ステータス更新日時',
    createdAt: '作成日時',
    updatedAt: '更新日時',
  };

  const matchesDateRange = (value: string | null, range: DateRangeValue): boolean => {
    if (!range.from && !range.to) return true;
    if (!value) return false;
    const datePart = value.slice(0, 10);
    if (range.from && datePart < range.from) return false;
    if (range.to && datePart > range.to) return false;
    return true;
  };

  const formatDateRangeChip = (range: DateRangeValue): string => {
    const from = range.from ? fmtDate(range.from) : null;
    const to = range.to ? fmtDate(range.to) : null;
    if (from && to) return `${from} 〜 ${to}`;
    if (from) return `${from} 以降`;
    if (to) return `${to} 以前`;
    return '';
  };

  // 日付範囲フィルタの設定 UI（バーの「日付」ポップオーバー）用。一覧では列ヘッダから設定するが、
  // ガント等ヘッダを持たない画面でも同じ範囲を設定できるよう、まとめて公開する。
  const dateRangeFilterDefs = Object.entries(dateFilters).map(([key, filter]) => ({
    key,
    label: DATE_FILTER_LABELS[key as keyof typeof dateFilters],
    filter,
  }));

  const dateFilterChips = computed(() =>
    dateRangeFilterDefs
      .filter((d) => d.filter.isActive.value)
      .map((d) => ({
        label: d.label,
        text: formatDateRangeChip(d.filter.range.value),
        clear: d.filter.clear,
      })),
  );

  const hasActiveDateFilter = computed(() => dateFilterChips.value.length > 0);

  const statusSelectItems = computed(() =>
    statuses.value.map((s) => ({ label: s.label, value: s.code })),
  );
  const prioritySelectItems = computed(() =>
    priorities.value.map((p) => ({ label: p.label, value: p.code })),
  );

  /** 担当者フィルタ用: 実際に誰かに割り当たっているメンバーのみ */
  const assigneeFilterItems = computed(() => {
    const ids = new Set(
      tasks.value.map((t) => t.assigneeMemberId).filter((id): id is string => Boolean(id)),
    );
    const items: { label: string; value: string }[] = members.value
      .filter((m) => ids.has(m.id))
      .map((m) => ({ label: m.displayName, value: m.id }));
    // タスクに担当者なしが含まれていれば先頭に追加
    if (tasks.value.some((t) => !t.assigneeMemberId)) {
      items.unshift({ label: '(担当者なし)', value: NO_ASSIGNEE });
    }
    // 選択中の担当者が items に無い場合（全タスクが完了して非表示になった等）でも
    // ラベルが ID に化けないように補う
    for (const current of assigneeFilter.value) {
      if (items.some((i) => i.value === current)) continue;
      if (current === NO_ASSIGNEE) {
        items.unshift({ label: '(担当者なし)', value: NO_ASSIGNEE });
      } else {
        const member = members.value.find((m) => m.id === current);
        if (member) items.push({ label: member.displayName, value: current });
      }
    }
    return items;
  });

  /** タグフィルタ用: 実際にタスクに付いているタグのみ */
  const tagFilterItems = computed(() => {
    const codes = new Set(tasks.value.flatMap((t) => t.tagCodes));
    return tags.value
      .filter((t) => codes.has(t.code))
      .map((t) => ({ label: t.name, value: t.code }));
  });

  /** フラグフィルタ用: 実際にタスクに付いているフラグのみ */
  const flagFilterItems = computed(() => {
    const codes = new Set(tasks.value.flatMap((t) => t.flagCodes));
    return flags.value
      .filter((f) => codes.has(f.code))
      .map((f) => ({ label: f.name, value: f.code }));
  });

  /** 完了系ステータスを表示するか（既定 false）。URL クエリで保持 */
  const showCompleted = computed<boolean>({
    get: () => queryString('showCompleted') === '1',
    set: (v) => updateQuery({ showCompleted: v ? '1' : undefined }),
  });

  const hasActiveFilter = computed(() =>
    Boolean(
      search.value ||
      FILTER_ARRAY_KEYS.some((k) => uiFilters[k].value.length > 0) ||
      showCompleted.value ||
      hasActiveDateFilter.value,
    ),
  );

  const resetFilters = () => {
    // フィルタ系クエリキーは FILTER_QUERY_KEYS が正本。ここで羅列を持つと追加時に漏れる。
    updateQuery(Object.fromEntries(FILTER_QUERY_KEYS.map((k) => [k, undefined])));
    // applied も直に空にする（SSR では scheduleApply が走らず取り残されるため）
    for (const key of FILTER_ARRAY_KEYS) {
      uiFilters[key].value = [];
      applied[key].value = [];
    }
  };

  const filteredTasks = computed(() => {
    // チェック直後のチラつき防止のため、applied 系 (rAF で 1 フレーム遅延) を使う
    const statusSet = new Set(applied.status.value);
    const prioritySet = new Set(applied.priority.value);
    const assigneeSet = new Set(applied.assignee.value);
    const tagSet = new Set(applied.tag.value);
    const tagNotSet = new Set(applied.tagNot.value);
    const flagSet = new Set(applied.flag.value);
    const flagNotSet = new Set(applied.flagNot.value);

    return tasks.value.filter((t) => {
      // ステータスフィルタが選択されていればそれを最優先（完了系も含めて表示）
      if (statusSet.size > 0) {
        if (!statusSet.has(t.statusCode)) return false;
      } else if (!showCompleted.value && statusMap.value[t.statusCode]?.isTerminal) {
        // ステータスフィルタなし & 「完了も表示」OFF のときは完了系を除外
        return false;
      }
      if (search.value) {
        const q = search.value.toLowerCase();
        // #番号 / 番号 は seq の前方一致でも引っかける（#は任意）
        const seqQuery = q.replace(/^#/, '');
        const matched =
          (/^\d+$/.test(seqQuery) && String(t.seq).startsWith(seqQuery)) ||
          t.content.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.links.some((l) => l.url.toLowerCase().includes(q));
        if (!matched) return false;
      }
      if (prioritySet.size > 0 && (!t.priorityCode || !prioritySet.has(t.priorityCode))) {
        return false;
      }
      if (assigneeSet.size > 0) {
        const matchesNone = !t.assigneeMemberId && assigneeSet.has(NO_ASSIGNEE);
        const matchesId = t.assigneeMemberId && assigneeSet.has(t.assigneeMemberId);
        if (!matchesNone && !matchesId) return false;
      }
      if (tagSet.size > 0 && !t.tagCodes.some((c) => tagSet.has(c))) return false;
      // 除外は「1つでも該当タグ/フラグを持てば隠す」
      if (tagNotSet.size > 0 && t.tagCodes.some((c) => tagNotSet.has(c))) return false;
      if (flagSet.size > 0 && !t.flagCodes.some((c) => flagSet.has(c))) return false;
      if (flagNotSet.size > 0 && t.flagCodes.some((c) => flagNotSet.has(c))) return false;
      // 日付範囲フィルタ。null 値は範囲指定中は除外。
      if (!matchesDateRange(t.deadline, deadlineFilter.range.value)) return false;
      if (!matchesDateRange(t.plannedStartDate, plannedStartFilter.range.value)) return false;
      if (!matchesDateRange(t.plannedCompletionDate, plannedCompletionFilter.range.value)) {
        return false;
      }
      if (!matchesDateRange(t.plannedReleaseDate, plannedReleaseFilter.range.value)) return false;
      if (!matchesDateRange(t.completedAt, completedAtFilter.range.value)) return false;
      if (!matchesDateRange(t.statusChangedAt, statusChangedAtFilter.range.value)) return false;
      if (!matchesDateRange(t.createdAt, createdAtFilter.range.value)) return false;
      if (!matchesDateRange(t.updatedAt, updatedAtFilter.range.value)) return false;
      return true;
    });
  });

  return {
    statusMap,
    search,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    tagFilter,
    tagNotFilter,
    flagFilter,
    flagNotFilter,
    showCompleted,
    hasActiveFilter,
    hasActiveDateFilter,
    resetFilters,
    statusSelectItems,
    prioritySelectItems,
    assigneeFilterItems,
    tagFilterItems,
    flagFilterItems,
    dateFilterChips,
    dateRangeFilterDefs,
    filteredTasks,
    // 以下は `filteredTasks` とは別の絞り込みを自前で組む画面向けの内部プリミティブ。
    // （タスク一覧のサブタスク子行は、親と違うフィルタ適用ルールを持つため必要）
    applied,
    dateFilters,
    matchesDateRange,
  };
};

export type TaskFilters = ReturnType<typeof useTaskFilters>;
