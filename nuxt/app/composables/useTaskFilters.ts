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
 * タスク一覧/ガント共通のフィルタ。状態は URL クエリで同期し、
 * `filteredTasks` に絞り込み結果を返す。UI バインドに必要な ref / items / chips も公開する。
 * （タスク一覧 index.vue のフィルタ実装をそのまま composable 化したもの。クエリキーも同一。）
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
  const statusFilter = ref<string[]>(queryArray('status'));
  const priorityFilter = ref<string[]>(queryArray('priority'));
  const assigneeFilter = ref<string[]>(queryArray('assignee'));
  const tagFilter = ref<string[]>(queryArray('tag'));
  const tagNotFilter = ref<string[]>(queryArray('tagNot'));
  const flagFilter = ref<string[]>(queryArray('flag'));
  const flagNotFilter = ref<string[]>(queryArray('flagNot'));

  const appliedStatusFilter = ref<string[]>([...statusFilter.value]);
  const appliedPriorityFilter = ref<string[]>([...priorityFilter.value]);
  const appliedAssigneeFilter = ref<string[]>([...assigneeFilter.value]);
  const appliedTagFilter = ref<string[]>([...tagFilter.value]);
  const appliedTagNotFilter = ref<string[]>([...tagNotFilter.value]);
  const appliedFlagFilter = ref<string[]>([...flagFilter.value]);
  const appliedFlagNotFilter = ref<string[]>([...flagNotFilter.value]);

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  let pendingFrame: number | null = null;
  const scheduleApply = () => {
    if (!import.meta.client) return;
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        if (!arraysEqual(appliedStatusFilter.value, statusFilter.value)) {
          appliedStatusFilter.value = [...statusFilter.value];
        }
        if (!arraysEqual(appliedPriorityFilter.value, priorityFilter.value)) {
          appliedPriorityFilter.value = [...priorityFilter.value];
        }
        if (!arraysEqual(appliedAssigneeFilter.value, assigneeFilter.value)) {
          appliedAssigneeFilter.value = [...assigneeFilter.value];
        }
        if (!arraysEqual(appliedTagFilter.value, tagFilter.value)) {
          appliedTagFilter.value = [...tagFilter.value];
        }
        if (!arraysEqual(appliedTagNotFilter.value, tagNotFilter.value)) {
          appliedTagNotFilter.value = [...tagNotFilter.value];
        }
        if (!arraysEqual(appliedFlagFilter.value, flagFilter.value)) {
          appliedFlagFilter.value = [...flagFilter.value];
        }
        if (!arraysEqual(appliedFlagNotFilter.value, flagNotFilter.value)) {
          appliedFlagNotFilter.value = [...flagNotFilter.value];
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
    const put = (key: string, arr: string[]) => {
      if (!arraysEqual(arr, queryArray(key))) {
        changes[key] = arr.length > 0 ? arr.join(',') : undefined;
      }
    };
    put('status', statusFilter.value);
    put('priority', priorityFilter.value);
    put('assignee', assigneeFilter.value);
    put('tag', tagFilter.value);
    put('tagNot', tagNotFilter.value);
    put('flag', flagFilter.value);
    put('flagNot', flagNotFilter.value);
    if (Object.keys(changes).length > 0) updateQuery(changes);
  };

  watch(
    [
      statusFilter,
      priorityFilter,
      assigneeFilter,
      tagFilter,
      tagNotFilter,
      flagFilter,
      flagNotFilter,
    ],
    () => scheduleApply(),
    {
      deep: true,
    },
  );

  // 戻る/進む・ディープリンク等で URL が外から変わったら ref を合わせる
  const appliedByKey: Record<string, Ref<string[]>> = {
    status: appliedStatusFilter,
    priority: appliedPriorityFilter,
    assignee: appliedAssigneeFilter,
    tag: appliedTagFilter,
    tagNot: appliedTagNotFilter,
    flag: appliedFlagFilter,
    flagNot: appliedFlagNotFilter,
  };
  const bindFromUrl = (filter: Ref<string[]>, key: string) => {
    watch(
      () => queryArray(key),
      (v) => {
        if (!arraysEqual(v, filter.value)) {
          filter.value = v;
          // URL 主導で来たので applied も即時同期
          appliedByKey[key]!.value = [...v];
        }
      },
      { deep: true },
    );
  };
  bindFromUrl(statusFilter, 'status');
  bindFromUrl(priorityFilter, 'priority');
  bindFromUrl(assigneeFilter, 'assignee');
  bindFromUrl(tagFilter, 'tag');
  bindFromUrl(tagNotFilter, 'tagNot');
  bindFromUrl(flagFilter, 'flag');
  bindFromUrl(flagNotFilter, 'flagNot');

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

  const dateFilterChips = computed(() =>
    [
      { label: '期限', filter: deadlineFilter },
      { label: '着手予定日', filter: plannedStartFilter },
      { label: '完了予定日', filter: plannedCompletionFilter },
      { label: 'リリース予定日', filter: plannedReleaseFilter },
      { label: '完了日時', filter: completedAtFilter },
      { label: 'ステータス更新日時', filter: statusChangedAtFilter },
      { label: '作成日時', filter: createdAtFilter },
      { label: '更新日時', filter: updatedAtFilter },
    ]
      .filter((c) => c.filter.isActive.value)
      .map((c) => ({
        label: c.label,
        text: formatDateRangeChip(c.filter.range.value),
        clear: c.filter.clear,
      })),
  );

  const hasActiveDateFilter = computed(() => dateFilterChips.value.length > 0);

  // 日付範囲フィルタの設定 UI（バーの「日付」ポップオーバー）用。一覧では列ヘッダから設定するが、
  // ガント等ヘッダを持たない画面でも同じ範囲を設定できるよう、まとめて公開する。
  const dateRangeFilterDefs = [
    { key: 'deadline', label: '期限', filter: deadlineFilter },
    { key: 'plannedStart', label: '着手予定日', filter: plannedStartFilter },
    { key: 'plannedCompletion', label: '完了予定日', filter: plannedCompletionFilter },
    { key: 'plannedRelease', label: 'リリース予定日', filter: plannedReleaseFilter },
    { key: 'completedAt', label: '完了日時', filter: completedAtFilter },
    { key: 'statusChangedAt', label: 'ステータス更新日時', filter: statusChangedAtFilter },
    { key: 'createdAt', label: '作成日時', filter: createdAtFilter },
    { key: 'updatedAt', label: '更新日時', filter: updatedAtFilter },
  ];

  const statusSelectItems = computed(() =>
    statuses.value.map((s) => ({ label: s.label, value: s.code })),
  );
  const prioritySelectItems = computed(() =>
    priorities.value.map((p) => ({ label: p.label, value: p.code })),
  );

  const assigneeFilterItems = computed(() => {
    const ids = new Set(
      tasks.value.map((t) => t.assigneeMemberId).filter((id): id is string => Boolean(id)),
    );
    const items: { label: string; value: string }[] = members.value
      .filter((m) => ids.has(m.id))
      .map((m) => ({ label: m.displayName, value: m.id }));
    if (tasks.value.some((t) => !t.assigneeMemberId)) {
      items.unshift({ label: '(担当者なし)', value: NO_ASSIGNEE });
    }
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

  const tagFilterItems = computed(() => {
    const codes = new Set(tasks.value.flatMap((t) => t.tagCodes));
    return tags.value
      .filter((t) => codes.has(t.code))
      .map((t) => ({ label: t.name, value: t.code }));
  });

  const flagFilterItems = computed(() => {
    const codes = new Set(tasks.value.flatMap((t) => t.flagCodes));
    return flags.value
      .filter((f) => codes.has(f.code))
      .map((f) => ({ label: f.name, value: f.code }));
  });

  const showCompleted = computed<boolean>({
    get: () => queryString('showCompleted') === '1',
    set: (v) => updateQuery({ showCompleted: v ? '1' : undefined }),
  });

  const hasActiveFilter = computed(() =>
    Boolean(
      search.value ||
      statusFilter.value.length > 0 ||
      priorityFilter.value.length > 0 ||
      assigneeFilter.value.length > 0 ||
      tagFilter.value.length > 0 ||
      tagNotFilter.value.length > 0 ||
      flagFilter.value.length > 0 ||
      flagNotFilter.value.length > 0 ||
      showCompleted.value ||
      hasActiveDateFilter.value,
    ),
  );

  const resetFilters = () => {
    updateQuery({
      search: undefined,
      status: undefined,
      priority: undefined,
      assignee: undefined,
      tag: undefined,
      tagNot: undefined,
      flag: undefined,
      flagNot: undefined,
      showCompleted: undefined,
      deadlineFrom: undefined,
      deadlineTo: undefined,
      plannedStartFrom: undefined,
      plannedStartTo: undefined,
      plannedCompletionFrom: undefined,
      plannedCompletionTo: undefined,
      plannedReleaseFrom: undefined,
      plannedReleaseTo: undefined,
      completedAtFrom: undefined,
      completedAtTo: undefined,
      statusChangedFrom: undefined,
      statusChangedTo: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      updatedFrom: undefined,
      updatedTo: undefined,
    });
    statusFilter.value = [];
    priorityFilter.value = [];
    assigneeFilter.value = [];
    tagFilter.value = [];
    tagNotFilter.value = [];
    flagFilter.value = [];
    flagNotFilter.value = [];
  };

  const filteredTasks = computed(() => {
    const statusSet = new Set(appliedStatusFilter.value);
    const prioritySet = new Set(appliedPriorityFilter.value);
    const assigneeSet = new Set(appliedAssigneeFilter.value);
    const tagSet = new Set(appliedTagFilter.value);
    const tagNotSet = new Set(appliedTagNotFilter.value);
    const flagSet = new Set(appliedFlagFilter.value);
    const flagNotSet = new Set(appliedFlagNotFilter.value);

    return tasks.value.filter((t) => {
      if (statusSet.size > 0) {
        if (!statusSet.has(t.statusCode)) return false;
      } else if (!showCompleted.value && statusMap.value[t.statusCode]?.isTerminal) {
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
  };
};

export type TaskFilters = ReturnType<typeof useTaskFilters>;
