import type { DateRangeValue } from '~/components/DateRangeFilter.vue';
import type { Flag, Tag, TaskPriority, TaskStatus } from '~/types/master';
import type { Member } from '~/types/member';
import type { Task } from '~/types/task';

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
/** フィルタメニュー / チップに出す選択肢 */
export interface FilterItem {
  label: string;
  value: string;
}

interface FilterDefBase {
  /** 表示名。フィルタ追加メニューに出る正式名 */
  label: string;
  /** チップ内の短縮表示名（省略時は label）。長いラベルでチップが伸びるのを防ぐ */
  chipLabel?: string;
  icon?: string;
}

/**
 * 単値フィールド（1 タスクが 1 つだけ値を持つ）。選択したいずれかに一致すれば通す。
 * 「含む」の選択が実質の除外を兼ねるので、除外状態は持たない。
 */
export interface SingleValueFilterDef extends FilterDefBase {
  kind: 'single';
  key: FilterArrayKey;
  /** そのタスクの値。null は「値なし」 */
  valueOf: (t: Task) => string | null;
  /**
   * 「値なし」を選択肢に出す場合の sentinel。指定が無いフィールドでは
   * 値が null のタスクはフィルタ選択中は常に除外される（優先度の既存挙動）。
   */
  noneValue?: string;
  /** 「値なし」選択肢のラベル */
  noneLabel?: string;
}

/**
 * 多値フィールド（1 タスクが複数値を持つ）。含む(OR) / 除外 の 3 状態を取る。
 * 除外は「1 つでも該当値を持てば隠す」。
 */
export interface MultiValueFilterDef extends FilterDefBase {
  kind: 'multi';
  key: FilterArrayKey;
  /** 除外側の URL クエリキー */
  notKey: FilterArrayKey;
  valuesOf: (t: Task) => string[];
}

/** 日付範囲フィルタ。null 値は範囲指定中は除外。 */
export interface DateRangeFilterDef extends FilterDefBase {
  kind: 'dateRange';
  key: DateFilterKey;
  fromKey: string;
  toKey: string;
  valueOf: (t: Task) => string | null;
}

export type FilterDef = SingleValueFilterDef | MultiValueFilterDef | DateRangeFilterDef;

/**
 * 配列値フィルタの URL クエリキー。`FILTER_DEFS` の `key` / `notKey` はこの型に
 * 縛られているので、フィルタを増やすときはここに 1 語足せば型エラーが道案内をする。
 */
/**
 * 日付範囲フィルタのキー。`FILTER_DEFS` の日付エントリはこの型に縛られているので、
 * 増やすときはここに 1 語足せば型エラーが道案内をする。
 */
export type DateFilterKey =
  | 'deadline'
  | 'plannedStart'
  | 'plannedCompletion'
  | 'plannedRelease'
  | 'completedAt'
  | 'statusChangedAt'
  | 'createdAt'
  | 'updatedAt';

export type FilterArrayKey =
  | 'status'
  | 'priority'
  | 'assignee'
  | 'tag'
  | 'tagNot'
  | 'flag'
  | 'flagNot';

/**
 * フィルタの正本。ここに 1 エントリ足すと、選択肢メニュー・チップ・URL 同期・
 * 絞り込み・クリア・保存ビューの対象すべてに反映される。
 * `items`（選択肢）だけはタスク/マスタのデータに依存するため composable 内で後付けする。
 */
export const FILTER_DEFS: FilterDef[] = [
  {
    kind: 'single',
    key: 'status',
    label: 'ステータス',
    valueOf: (t) => t.statusCode,
  },
  {
    kind: 'single',
    key: 'priority',
    label: '優先度',
    valueOf: (t) => t.priorityCode,
  },
  {
    kind: 'single',
    key: 'assignee',
    label: '担当者',
    icon: 'i-lucide-user',
    valueOf: (t) => t.assigneeMemberId,
    noneValue: NO_ASSIGNEE,
    noneLabel: '(担当者なし)',
  },
  {
    kind: 'multi',
    key: 'tag',
    notKey: 'tagNot',
    label: 'タグ',
    icon: 'i-lucide-tag',
    valuesOf: (t) => t.tagCodes,
  },
  {
    kind: 'multi',
    key: 'flag',
    notKey: 'flagNot',
    label: 'フラグ',
    icon: 'i-lucide-bookmark',
    valuesOf: (t) => t.flagCodes,
  },
  {
    kind: 'dateRange',
    key: 'deadline',
    fromKey: 'deadlineFrom',
    toKey: 'deadlineTo',
    label: '期限',
    valueOf: (t) => t.deadline,
  },
  {
    kind: 'dateRange',
    key: 'plannedStart',
    fromKey: 'plannedStartFrom',
    toKey: 'plannedStartTo',
    label: '着手予定日',
    valueOf: (t) => t.plannedStartDate,
  },
  {
    kind: 'dateRange',
    key: 'plannedCompletion',
    fromKey: 'plannedCompletionFrom',
    toKey: 'plannedCompletionTo',
    label: '完了予定日',
    valueOf: (t) => t.plannedCompletionDate,
  },
  {
    kind: 'dateRange',
    key: 'plannedRelease',
    fromKey: 'plannedReleaseFrom',
    toKey: 'plannedReleaseTo',
    label: 'リリース予定日',
    valueOf: (t) => t.plannedReleaseDate,
  },
  {
    kind: 'dateRange',
    key: 'completedAt',
    fromKey: 'completedAtFrom',
    toKey: 'completedAtTo',
    label: '完了日時',
    valueOf: (t) => t.completedAt,
  },
  {
    kind: 'dateRange',
    key: 'statusChangedAt',
    fromKey: 'statusChangedFrom',
    toKey: 'statusChangedTo',
    label: 'ステータス更新日時',
    chipLabel: 'ステータス更新',
    valueOf: (t) => t.statusChangedAt,
  },
  {
    kind: 'dateRange',
    key: 'createdAt',
    fromKey: 'createdFrom',
    toKey: 'createdTo',
    label: '作成日時',
    valueOf: (t) => t.createdAt,
  },
  {
    kind: 'dateRange',
    key: 'updatedAt',
    fromKey: 'updatedFrom',
    toKey: 'updatedTo',
    label: '更新日時',
    valueOf: (t) => t.updatedAt,
  },
];

/** 配列値フィルタ（単値 + 多値）の定義だけを取り出したもの */
export const VALUE_FILTER_DEFS = FILTER_DEFS.filter(
  (d): d is SingleValueFilterDef | MultiValueFilterDef => d.kind !== 'dateRange',
);

/** 日付範囲フィルタの定義だけを取り出したもの */
export const DATE_FILTER_DEFS = FILTER_DEFS.filter(
  (d): d is DateRangeFilterDef => d.kind === 'dateRange',
);

/**
 * 配列値フィルタのクエリキー一覧。多値フィルタは除外側の `notKey` も持つ。
 * UI バインド用 ref・applied 用 ref・URL 同期の 3 者がこの 1 本を回ることで、
 * フィルタ追加時に片方だけ直して board と一覧で挙動が食い違う事故を防ぐ。
 */
export const FILTER_ARRAY_KEYS: FilterArrayKey[] = VALUE_FILTER_DEFS.flatMap((d) =>
  d.kind === 'multi' ? [d.key, d.notKey] : [d.key],
);

/**
 * フィルタとして扱う URL クエリキー一覧（永続化・共有の対象）。
 * `useTaskFilterMemory` の記憶対象と SavedView の保存対象がこれを参照する。
 */
export const FILTER_QUERY_KEYS: string[] = [
  'search',
  ...FILTER_ARRAY_KEYS,
  'showCompleted',
  ...DATE_FILTER_DEFS.flatMap((d) => [d.fromKey, d.toKey]),
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

  // 名前で参照したい分だけのエイリアス（実体は uiFilters の ref と同一）。
  // statusFilter は「完了も表示」の活性判定、assigneeFilter は選択肢の補完に使う。
  const { status: statusFilter, assignee: assigneeFilter } = uiFilters;

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

  /**
   * 日付範囲フィルタの実体を定義から生成し、キー引きでまとめたもの。
   * チップ / 設定 UI / 一覧の列ヘッダ がすべてここを読み書きするので、
   * どこから変更しても他が追随する。
   */
  const dateFilters = Object.fromEntries(
    DATE_FILTER_DEFS.map((d) => [d.key, useDateRangeFilter(d.fromKey, d.toKey)]),
  ) as Record<DateFilterKey, ReturnType<typeof useDateRangeFilter>>;

  const matchesDateRange = (value: string | null, range: DateRangeValue): boolean => {
    if (!range.from && !range.to) return true;
    if (!value) return false;
    const datePart = value.slice(0, 10);
    if (range.from && datePart < range.from) return false;
    if (range.to && datePart > range.to) return false;
    return true;
  };

  const hasActiveDateFilter = computed(() =>
    DATE_FILTER_DEFS.some((d) => dateFilters[d.key].isActive.value),
  );

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
    const sets = Object.fromEntries(
      FILTER_ARRAY_KEYS.map((k) => [k, new Set(applied[k].value)]),
    ) as Record<FilterArrayKey, Set<string>>;

    return tasks.value.filter((t) => {
      // ステータスは「完了も表示」と相互作用するので定義ループから外して個別に見る。
      // ステータスフィルタが選択されていればそれを最優先（完了系も含めて表示）
      if (sets.status.size > 0) {
        if (!sets.status.has(t.statusCode)) return false;
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
      for (const d of VALUE_FILTER_DEFS) {
        if (d.key === 'status') continue; // 上で処理済み
        if (d.kind === 'single') {
          const set = sets[d.key];
          if (set.size === 0) continue;
          const v = d.valueOf(t);
          // 値なしのタスクは、sentinel が定義されていてそれが選ばれている場合だけ通す
          const ok = v ? set.has(v) : Boolean(d.noneValue && set.has(d.noneValue));
          if (!ok) return false;
        } else {
          const include = sets[d.key];
          const exclude = sets[d.notKey];
          const values = d.valuesOf(t);
          if (include.size > 0 && !values.some((v) => include.has(v))) return false;
          // 除外は「1つでも該当値を持てば隠す」
          if (exclude.size > 0 && values.some((v) => exclude.has(v))) return false;
        }
      }
      // 日付範囲フィルタ。null 値は範囲指定中は除外。
      for (const d of DATE_FILTER_DEFS) {
        if (!matchesDateRange(d.valueOf(t), dateFilters[d.key].range.value)) return false;
      }
      return true;
    });
  });

  /**
   * 選択肢はフィルタごとに出所（マスタ / タスクに実在する値）が違うので、
   * 定義側には持たせずここでキーに対応付ける。多値フィルタは含む/除外で同じ選択肢を使う。
   */
  const filterItems: Record<FilterArrayKey, ComputedRef<FilterItem[]>> = {
    status: statusSelectItems,
    priority: prioritySelectItems,
    assignee: assigneeFilterItems,
    tag: tagFilterItems,
    tagNot: tagFilterItems,
    flag: flagFilterItems,
    flagNot: flagFilterItems,
  };

  /**
   * 定義 + 選択肢 + ref をまとめた、UI がそのまま描画できる形。
   * フィルタバーはこれをループするだけでよく、フィルタ単位のマークアップを持たない。
   */
  const valueFilters = VALUE_FILTER_DEFS.map((d) => ({
    def: d,
    items: filterItems[d.key],
    /** 含む側の選択値（v-model 先） */
    include: uiFilters[d.key],
    /** 除外側の選択値。単値フィルタでは null */
    exclude: d.kind === 'multi' ? uiFilters[d.notKey] : null,
    isActive: computed(
      () =>
        uiFilters[d.key].value.length > 0 ||
        (d.kind === 'multi' && uiFilters[d.notKey].value.length > 0),
    ),
    clear: () => {
      uiFilters[d.key].value = [];
      if (d.kind === 'multi') uiFilters[d.notKey].value = [];
    },
  }));

  /**
   * チップバー用: 値フィルタと日付フィルタを `FILTER_DEFS` の順で 1 本にしたもの。
   * 「+ フィルタ」メニューもチップ列もこの 1 本を回すので、定義を足せば両方に出る。
   */
  const chipFilters = [
    ...valueFilters.map((f) => ({
      kind: 'value' as const,
      key: f.def.key,
      label: f.def.label,
      chipLabel: f.def.chipLabel ?? f.def.label,
      icon: f.def.icon,
      triState: f.def.kind === 'multi',
      items: f.items,
      include: f.include,
      // 単値フィルタに除外状態は無いが、UI 側の分岐を減らすため空 ref を置く。
      // triState=false のリストは exclude を書き換えないので、この ref は常に空のまま。
      exclude: f.exclude ?? ref<string[]>([]),
      isActive: f.isActive,
      clear: f.clear,
    })),
    ...DATE_FILTER_DEFS.map((d) => ({
      kind: 'date' as const,
      key: d.key,
      label: d.label,
      chipLabel: d.chipLabel ?? d.label,
      icon: d.icon,
      range: dateFilters[d.key].range,
      isActive: dateFilters[d.key].isActive,
      clear: dateFilters[d.key].clear,
    })),
  ];

  return {
    statusMap,
    search,
    statusFilter,
    showCompleted,
    hasActiveFilter,
    hasActiveDateFilter,
    resetFilters,
    statusSelectItems,
    prioritySelectItems,
    filteredTasks,
    /** チップバーが回す、値 + 日付を通した 1 本のフィルタ一覧 */
    chipFilters,
    // 以下は `filteredTasks` とは別の絞り込みを自前で組む画面向けの内部プリミティブ。
    // （タスク一覧のサブタスク子行は、親と違うフィルタ適用ルールを持つため必要）
    applied,
    dateFilters,
    matchesDateRange,
  };
};

export type TaskFilters = ReturnType<typeof useTaskFilters>;
