<script setup lang="ts">
import dayjs from 'dayjs';
import { h, resolveComponent } from 'vue';
import type { ColumnSizingInfoState, Row } from '@tanstack/vue-table';
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui';
import { VueDraggable } from 'vue-draggable-plus';
import {
  apiCreateSavedView,
  apiDeleteSavedView,
  apiDuplicateSavedView,
  apiUpdateSavedView,
} from '~/api/saved-views';
import { apiUpdateSubtask } from '~/api/subtasks';
import {
  apiBulkUpdateTasks,
  apiGetTask,
  apiGetTaskBySeq,
  apiUpdateTask,
  type BulkUpdateTasksInput,
} from '~/api/tasks';
import type { DateRangeValue } from '~/components/DateRangeFilter.vue';
import type { SavedView, SavedViewConfig, SavedViewVisibility } from '~/types/saved-view';
import type { SubtaskRow } from '~/types/subtask';
import type { Task } from '~/types/task';
import { fmtDate, fmtDateTime } from '~/utils/date';
import { isTaskDatePast } from '~/utils/task-overdue';

const api = useApi();

// テーマ切替: 初期は preference='system' のまま OS に追従。クリック時に
// 現在描画されている方の反対側 (light <-> dark) に preference を上書きする。
const colorMode = useColorMode();
const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
};
const colorModeIcon = computed(() =>
  colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun',
);
const colorModeAriaLabel = computed(() =>
  colorMode.value === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え',
);

const UButton = resolveComponent('UButton');
const UIcon = resolveComponent('UIcon');
const UPopover = resolveComponent('UPopover');
const DateRangeFilter = resolveComponent('DateRangeFilter');

const route = useRoute();
const router = useRouter();

const currentProjectId = useCurrentProjectId();
const currentUserId = useCurrentUserId();

// 既定では完了タスクを取得しない（ペイロード削減）。完了表示 ON、または
// ステータスを明示選択しているとき（終端ステータス選択もあり得る）は全件取得する。
// 後段の showCompleted / statusFilter ref より前で評価するため URL クエリを直接見る。
const includeCompleted = computed(
  () => route.query.showCompleted === '1' || Boolean(route.query.status),
);

// フィルタを画面間で共有・記憶（await より前に登録）。一覧は SavedView と協調した
// 独自復元を行うため自動復元は切り、保存のみ利用する。
useTaskFilterMemory({ autoRestore: false });

const {
  data: tasks,
  refresh: refreshTasks,
  status: tasksStatus,
} = await useTasks(currentProjectId, includeCompleted);
const { data: projectSubtasks, refresh: refreshSubtasks } =
  await useProjectSubtasks(currentProjectId);
const { data: statuses } = await useTaskStatuses(currentProjectId);
const { data: priorities } = await useTaskPriorities(currentProjectId);
const { data: tags } = await useTags(currentProjectId);
const { data: flags } = await useFlags(currentProjectId);
const { data: members } = await useMembers(currentProjectId);
const { data: departments } = await useDepartments();
const { data: projects } = await useProjects();
const { data: savedViews, refresh: refreshSavedViews } = await useSavedViews(currentProjectId);
const currentProject = computed(() => projects.value.find((p) => p.id === currentProjectId.value));

const currentMemberId = computed<string | null>(() => {
  const userId = currentUserId.value;
  if (!userId) return null;
  return members.value.find((m) => m.userId === userId)?.id ?? null;
});

const statusMap = computed(() => Object.fromEntries(statuses.value.map((s) => [s.code, s])));
const priorityMap = computed(() => Object.fromEntries(priorities.value.map((p) => [p.code, p])));
const tagMap = computed(() => Object.fromEntries(tags.value.map((t) => [t.code, t])));
const flagMap = computed(() => Object.fromEntries(flags.value.map((f) => [f.code, f])));
const memberMap = computed(() => Object.fromEntries(members.value.map((m) => [m.id, m])));
const departmentMap = computed(() => Object.fromEntries(departments.value.map((d) => [d.code, d])));

// ===== フィルタ / ソート: URL クエリで同期 =====
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
const setQueryArray = (key: string, arr: string[]) => {
  updateQuery({ [key]: arr.length > 0 ? arr.join(',') : undefined });
};

const search = computed<string>({
  get: () => queryString('search'),
  set: (v) => updateQuery({ search: v || undefined }),
});

// マルチセレクトのチェック反映を「クリック直後」に出すため、UI バインド用の
// ref と、テーブル描画に使う applied 用 ref を分ける。
// - v-model は statusFilter 等にバインド: 即時更新でチェックボックスがすぐ反映
// - applied 系は requestAnimationFrame で 1 フレーム遅らせて反映: 重いテーブル
//   再描画が次フレームに回り、チェックが先に描画される
// URL の同期も applied と同じタイミングに寄せる。
const statusFilter = ref<string[]>(queryArray('status'));
const priorityFilter = ref<string[]>(queryArray('priority'));
const assigneeFilter = ref<string[]>(queryArray('assignee'));
const tagFilter = ref<string[]>(queryArray('tag'));
const flagFilter = ref<string[]>(queryArray('flag'));

const appliedStatusFilter = ref<string[]>([...statusFilter.value]);
const appliedPriorityFilter = ref<string[]>([...priorityFilter.value]);
const appliedAssigneeFilter = ref<string[]>([...assigneeFilter.value]);
const appliedTagFilter = ref<string[]>([...tagFilter.value]);
const appliedFlagFilter = ref<string[]>([...flagFilter.value]);

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

let pendingFrame: number | null = null;
const scheduleApply = () => {
  if (!import.meta.client) return;
  if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
  // rAF 1 回目は「今フレームの paint 直前」に走るため、チェックボックスの描画と
  // 同フレームになる。次フレームまで遅らせるために rAF を 2 段ネストする。
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
      if (!arraysEqual(appliedFlagFilter.value, flagFilter.value)) {
        appliedFlagFilter.value = [...flagFilter.value];
      }
      syncFiltersToUrl();
    });
  });
};

const syncFiltersToUrl = () => {
  if (!arraysEqual(statusFilter.value, queryArray('status'))) {
    setQueryArray('status', statusFilter.value);
  }
  if (!arraysEqual(priorityFilter.value, queryArray('priority'))) {
    setQueryArray('priority', priorityFilter.value);
  }
  if (!arraysEqual(assigneeFilter.value, queryArray('assignee'))) {
    setQueryArray('assignee', assigneeFilter.value);
  }
  if (!arraysEqual(tagFilter.value, queryArray('tag'))) {
    setQueryArray('tag', tagFilter.value);
  }
  if (!arraysEqual(flagFilter.value, queryArray('flag'))) {
    setQueryArray('flag', flagFilter.value);
  }
};

watch(
  [statusFilter, priorityFilter, assigneeFilter, tagFilter, flagFilter],
  () => scheduleApply(),
  {
    deep: true,
  },
);

// 戻る/進む・ディープリンク等で URL が外から変わったら ref を合わせる
const bindFromUrl = (filter: Ref<string[]>, key: string) => {
  watch(
    () => queryArray(key),
    (v) => {
      if (!arraysEqual(v, filter.value)) {
        filter.value = v;
        // URL 主導で来たので applied も即時同期
        const target =
          key === 'status'
            ? appliedStatusFilter
            : key === 'priority'
              ? appliedPriorityFilter
              : key === 'assignee'
                ? appliedAssigneeFilter
                : key === 'tag'
                  ? appliedTagFilter
                  : appliedFlagFilter;
        target.value = [...v];
      }
    },
    { deep: true },
  );
};
bindFromUrl(statusFilter, 'status');
bindFromUrl(priorityFilter, 'priority');
bindFromUrl(assigneeFilter, 'assignee');
bindFromUrl(tagFilter, 'tag');
bindFromUrl(flagFilter, 'flag');

// ===== 日付範囲フィルタ =====
// 期限 / 完了予定日 / リリース予定日 / 完了日時 を URL クエリと双方向同期する。
// completedAt のみ datetime 値だが、フィルタは「日付」単位で比較する（matchesDateRange 参照）。
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
      updateQuery({
        [queryKeyFrom]: v.from ?? undefined,
        [queryKeyTo]: v.to ?? undefined,
      });
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
const plannedCompletionFilter = useDateRangeFilter('plannedCompletionFrom', 'plannedCompletionTo');
const plannedReleaseFilter = useDateRangeFilter('plannedReleaseFrom', 'plannedReleaseTo');
const completedAtFilter = useDateRangeFilter('completedAtFrom', 'completedAtTo');
const statusChangedAtFilter = useDateRangeFilter('statusChangedFrom', 'statusChangedTo');
const createdAtFilter = useDateRangeFilter('createdFrom', 'createdTo');
const updatedAtFilter = useDateRangeFilter('updatedFrom', 'updatedTo');

/**
 * タスクの日付列値 (date or datetime) が範囲に含まれるか。
 * - value が null かつ範囲指定中: 除外
 * - completedAt のような datetime も先頭 10 文字 (YYYY-MM-DD) で日付比較
 */
const matchesDateRange = (value: string | null, range: DateRangeValue): boolean => {
  if (!range.from && !range.to) return true;
  if (!value) return false;
  const datePart = value.slice(0, 10);
  if (range.from && datePart < range.from) return false;
  if (range.to && datePart > range.to) return false;
  return true;
};

/** チップ表示用: from/to の片方だけ指定なら「以降」「以前」と表現する */
const formatDateRangeChip = (range: DateRangeValue): string => {
  const from = range.from ? fmtDate(range.from) : null;
  const to = range.to ? fmtDate(range.to) : null;
  if (from && to) return `${from} 〜 ${to}`;
  if (from) return `${from} 以降`;
  if (to) return `${to} 以前`;
  return '';
};

/** チップ列で繰り返し描画するためのメタ情報。computed 内で .value を展開して再評価を効かせる */
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

const statusSelectItems = computed(() =>
  statuses.value.map((s) => ({ label: s.label, value: s.code })),
);
const prioritySelectItems = computed(() =>
  priorities.value.map((p) => ({ label: p.label, value: p.code })),
);
// このページでの用途は行内の担当者ピッカー（タスク/サブタスク）のみなので、
// readonly（閲覧のみ）ユーザー紐づきメンバーを除外する（依頼者の行内編集は無い）
const memberSelectItems = computed(() =>
  assignableMembers(members.value).map((m) => ({ label: m.displayName, value: m.id })),
);

/** 担当者フィルタ用: 実際に誰かに割り当たっているメンバーのみ */
/** 「担当者なし」を表す sentinel（実 ID と衝突しない値） */
const NO_ASSIGNEE = '__none__';

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
  return tags.value.filter((t) => codes.has(t.code)).map((t) => ({ label: t.name, value: t.code }));
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
    statusFilter.value.length > 0 ||
    priorityFilter.value.length > 0 ||
    assigneeFilter.value.length > 0 ||
    tagFilter.value.length > 0 ||
    flagFilter.value.length > 0 ||
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
    flag: undefined,
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
};

// ===== タスク詳細スライドオーバー: URL クエリで連動 =====
// URL にはタスクの連番(seq, 表示用 #N)を載せる。詳細ページは projectId スコープなので
// seq はプロジェクト内一意で曖昧にならない。内部処理は解決した Task の id を使う。
// 旧 URL は UUID を載せていたので、後方互換で id 解決も受け付ける（解決後 seq に正規化）。
const taskParam = computed<string | null>(() => queryString('task') || null);

// 一覧から解決したタスク（取得対象＝既定では未完了のみ、に依存）
const taskFromList = computed<Task | null>(() => {
  const raw = taskParam.value;
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) {
    return tasks.value.find((t) => t.seq === n) ?? null;
  }
  // 後方互換: 旧 URL の UUID
  return tasks.value.find((t) => t.id === raw) ?? null;
});

// 開いているタスクのキャッシュ。詳細スライドで完了（終端ステータス）にすると
// 既定の一覧取得（未完了のみ）から外れて解決できなくなるため、直近の値を保持して
// スライドを開いたままにする。一覧に居る間は最新へ同期する。
const openTaskCache = ref<Task | null>(null);
// immediate: 再読込/ディープリンクで初回から解決済みのケースもキャッシュに取り込む
watch(
  taskFromList,
  (t) => {
    if (t) openTaskCache.value = t;
  },
  { immediate: true },
);
// task パラメータが消えた（スライドを閉じた）らキャッシュを捨てる。
// closeSlideover で先に null にすると、URL が seq のまま selectedTask が null になり
// normalizeTaskParam が「見つかりません」を誤発火するため、パラメータ消滅に同期させる。
// コメントアイコンから開いたときだけ true。詳細スライドをコメント位置へスクロールさせる一回限りの意図。
const focusComments = ref(false);
watch(taskParam, (raw) => {
  if (!raw) {
    openTaskCache.value = null;
    focusComments.value = false;
  }
});

const selectedTask = computed<Task | null>(() => {
  const raw = taskParam.value;
  if (!raw) return null;
  if (taskFromList.value) return taskFromList.value;
  // 一覧から外れた場合でも、キャッシュが同じタスクを指していればそれを使う
  const cached = openTaskCache.value;
  if (cached && (String(cached.seq) === raw || cached.id === raw)) return cached;
  return null;
});

// 該当タスクが解決できたときだけ開く（未存在の番号で空パネルを出さない）。
const slideoverOpen = computed(() => selectedTask.value !== null);

const setSelectedTaskSeq = (seq: number | null) => {
  updateQuery({ task: seq === null ? undefined : String(seq) });
};

const openTask = (task: Task) => {
  focusComments.value = false;
  setSelectedTaskSeq(task.seq);
};

// コメントアイコンから開く: コメント位置までスクロールする意図を立ててから開く
const openTaskComments = (task: Task) => {
  focusComments.value = true;
  setSelectedTaskSeq(task.seq);
};

const closeSlideover = () => {
  setSelectedTaskSeq(null);
};

const createSlideoverOpen = ref(false);
const flagOpsOpen = ref(false);
const toast = useToast();

// URL の task パラメータを検証・正規化する。
// - 見つからない番号/ID → 通知して一覧へ戻す（空パネルを出さない）
// - UUID 等 seq 以外で解決できた場合 → URL を seq へ正規化
// 同じ param に対して一覧の再取得を一度だけ試したか（無限ループ防止）
let refreshedForParam: string | null = null;
// 解決処理（再取得→単体取得）の実行中フラグ。処理中は watcher の再入で
// 「見つかりません」を誤発火しない（refreshTasks の status 変化で再入するため）。
let resolvingParam = false;
const normalizeTaskParam = async () => {
  const raw = taskParam.value;
  if (raw === null) {
    refreshedForParam = null;
    return;
  }
  // 一覧の読込が完了するまでは判定しない（取得中に selectedTask が一時的に null になり
  // 「見つかりません」を誤発火するのを防ぐ）。
  if (tasksStatus.value !== 'success') return;
  if (resolvingParam) return;

  // 読込済みでも見つからない場合、一覧が古い可能性（他ユーザーが作成した新着タスクを
  // 通知から開いた等）。同じ param につき一度だけ再取得してから再判定する。
  if (!selectedTask.value && refreshedForParam !== raw) {
    refreshedForParam = raw;
    resolvingParam = true;
    try {
      await refreshTasks();
      // 再取得でも解決できない場合、一覧の取得対象外（完了済み等）の可能性。
      // 単体取得で解決してキャッシュに載せ、スライドを開けるようにする。
      if (!selectedTask.value) {
        try {
          const n = Number(raw);
          const fetched =
            Number.isInteger(n) && n > 0
              ? await apiGetTaskBySeq(api, currentProjectId.value, n)
              : await apiGetTask(api, currentProjectId.value, raw); // 旧 URL の UUID 互換
          openTaskCache.value = fetched;
        } catch {
          // 単体でも見つからない → 下の「見つかりません」処理へ
        }
      }
    } finally {
      resolvingParam = false;
    }
    // 解決中に別のタスクへ移った/閉じた場合は、この呼び出しでは何もしない
    if (taskParam.value !== raw) return;
  }

  const task = selectedTask.value;
  if (!task) {
    toast.add({ title: '指定されたタスクは見つかりませんでした', color: 'warning' });
    setSelectedTaskSeq(null);
    return;
  }
  if (raw !== String(task.seq)) {
    setSelectedTaskSeq(task.seq);
  }
};
watch([taskParam, selectedTask, tasksStatus], normalizeTaskParam);
onMounted(normalizeTaskParam);

const onTaskCreated = async (task: Task) => {
  await refreshTasks();
  toast.add({
    title: 'タスクを作成しました',
    description: `#${task.seq} ${task.content}`,
    color: 'success',
    icon: 'i-lucide-check',
    actions: [
      {
        label: '開く',
        color: 'success',
        variant: 'outline',
        onClick: () => setSelectedTaskSeq(task.seq),
      },
    ],
  });
};

const filteredTasks = computed(() => {
  // チェック直後のチラつき防止のため、applied 系 (rAF で 1 フレーム遅延) を使う
  const statusSet = new Set(appliedStatusFilter.value);
  const prioritySet = new Set(appliedPriorityFilter.value);
  const assigneeSet = new Set(appliedAssigneeFilter.value);
  const tagSet = new Set(appliedTagFilter.value);
  const flagSet = new Set(appliedFlagFilter.value);

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
    if (flagSet.size > 0 && !t.flagCodes.some((c) => flagSet.has(c))) return false;
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

// ===== サブタスク（案X: 一覧に子行として出す） =====
type DisplayRow = Task & { __kind: 'task' | 'sub'; __sub?: SubtaskRow };
const isSubRow = (r: Task): boolean => (r as DisplayRow).__kind === 'sub';
const subOf = (r: Task): SubtaskRow | undefined => (r as DisplayRow).__sub;

// deadline 以外の日付範囲フィルタが有効か（子は deadline しか持たないので、その時は子を除外）
const hasNonDeadlineDateFilter = computed(
  () =>
    plannedStartFilter.isActive.value ||
    plannedCompletionFilter.isActive.value ||
    plannedReleaseFilter.isActive.value ||
    completedAtFilter.isActive.value ||
    statusChangedAtFilter.isActive.value ||
    createdAtFilter.isActive.value ||
    updatedAtFilter.isActive.value,
);

// 一覧に出すサブタスク行（担当/期限/検索/フラグ/完了表示を適用。ステータス等の絞り込み時は除外）
const filteredSubtaskRows = computed<SubtaskRow[]>(() => {
  if (
    appliedStatusFilter.value.length > 0 ||
    appliedPriorityFilter.value.length > 0 ||
    appliedTagFilter.value.length > 0 ||
    hasNonDeadlineDateFilter.value
  ) {
    return [];
  }
  const assigneeSet = new Set(appliedAssigneeFilter.value);
  const flagSet = new Set(appliedFlagFilter.value);
  return projectSubtasks.value.filter((s) => {
    if (!showCompleted.value && s.done) return false;
    if (search.value) {
      const q = search.value.toLowerCase();
      const seqQuery = q.replace(/^#/, '');
      const matched =
        (/^\d+$/.test(seqQuery) && String(s.parentSeq).startsWith(seqQuery)) ||
        s.title.toLowerCase().includes(q) ||
        s.parentContent.toLowerCase().includes(q);
      if (!matched) return false;
    }
    if (assigneeSet.size > 0) {
      const matchesNone = !s.assigneeMemberId && assigneeSet.has(NO_ASSIGNEE);
      const matchesId = s.assigneeMemberId && assigneeSet.has(s.assigneeMemberId);
      if (!matchesNone && !matchesId) return false;
    }
    // フラグは子も自分の値を持つのでフィルタを適用する
    if (flagSet.size > 0 && !s.flagCodes.some((c) => flagSet.has(c))) return false;
    if (!matchesDateRange(s.deadline, deadlineFilter.range.value)) return false;
    return true;
  });
});

// 「表示対象の子」を持つ親の id。束ね役として親行を隠すのはこの集合だけ。
// 子が全部フィルタで消える（例: 全完了 & 完了非表示）親は、消えないよう通常行で出す。
const parentTaskIds = computed(() => new Set(filteredSubtaskRows.value.map((s) => s.taskId)));

// タスクごとのサブタスク進捗（done/total）。親行のバッジ表示に使う
const subtaskProgress = computed(() => {
  const m = new Map<string, { done: number; total: number }>();
  for (const s of projectSubtasks.value) {
    const e = m.get(s.taskId) ?? { done: 0, total: 0 };
    e.total += 1;
    if (s.done) e.done += 1;
    m.set(s.taskId, e);
  }
  return m;
});

// 一覧に出すタスク行（表示対象の子を持つ親のみ除外）。選択・件数もこれを基準にする
const visibleTasks = computed(() =>
  filteredTasks.value.filter((t) => !parentTaskIds.value.has(t.id)),
);

// 表示行 = タスク行 ＋ サブタスク（子）。ソートは UTable がこの配列に対して行う
const displayRows = computed<Task[]>(() => {
  const taskRows: DisplayRow[] = visibleTasks.value.map((t) => ({ ...t, __kind: 'task' }));
  const subRows: DisplayRow[] = filteredSubtaskRows.value.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    shortCode: '',
    seq: s.parentSeq, // No ソートは親タスクの位置に子がまとまる（親行は畳まれて出ないため）
    content: s.title,
    description: '',
    links: [],
    statusCode: '',
    priorityCode: null,
    assigneeMemberId: s.assigneeMemberId,
    requesterMemberId: null,
    requestingDeptCode: null,
    deadline: s.deadline,
    plannedStartDate: null,
    plannedCompletionDate: null,
    plannedReleaseDate: null,
    completedAt: null,
    statusChangedAt: s.updatedAt,
    tagCodes: [],
    flagCodes: s.flagCodes,
    commentCount: 0,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    __kind: 'sub',
    __sub: s,
  }));
  return [...taskRows, ...subRows];
});

// 子行のインライン完了トグル
const toggleSubtaskDone = async (s: SubtaskRow, done: boolean) => {
  await apiUpdateSubtask(api, currentProjectId.value, s.taskId, s.id, { done });
  await refreshSubtasks();
};
// 子行の担当・期限・フラグのインライン編集
const updateSubtaskField = async (
  s: SubtaskRow,
  patch: { assigneeMemberId?: string | null; deadline?: string | null; flagCodes?: string[] },
) => {
  try {
    await apiUpdateSubtask(api, currentProjectId.value, s.taskId, s.id, patch);
    await refreshSubtasks();
  } catch (e) {
    const message = (e as { data?: { message?: string } }).data?.message;
    toast.add({
      title: 'サブタスクを更新できませんでした',
      description: message,
      color: 'error',
    });
  }
};
// 子行クリックで親タスク詳細を開く
const openParentOfSub = (s: SubtaskRow) => setSelectedTaskSeq(s.parentSeq);
// 子の期限切れ（未完了 かつ 期限が今日より前）
const subOverdue = (s: SubtaskRow): boolean =>
  Boolean(s.deadline) && !s.done && dayjs(s.deadline).isBefore(dayjs(), 'day');
// 子の期限が親タスクの期限を超えている（詳細パネルと同じ警告）
const subOverParent = (s: SubtaskRow): boolean =>
  Boolean(s.deadline && s.parentDeadline && s.deadline > s.parentDeadline);

const sorting = computed<{ id: string; desc: boolean }[]>({
  get: () => {
    // 未指定時は空配列を返す。実在しない列 id を渡すと TanStack Table が
    // 「Column with id 'id' does not exist.」と警告するため。
    const id = queryString('sort');
    if (!id) return [];
    return [{ id, desc: queryString('sortDir') === 'desc' }];
  },
  set: (v) => {
    if (v.length === 0) {
      updateQuery({ sort: undefined, sortDir: undefined });
    } else {
      updateQuery({ sort: v[0]!.id, sortDir: v[0]!.desc ? 'desc' : 'asc' });
    }
  },
});

interface SortColumn {
  getIsSorted: () => false | 'asc' | 'desc';
  /** 引数なしで呼ぶと 3-state 循環: 未ソート → asc → desc → 未ソート */
  toggleSorting: () => void;
  getCanResize: () => boolean;
  getIsResizing: () => boolean;
}
interface ResizeHeader {
  getResizeHandler: () => (e: unknown) => void;
  column: { id: string; getIsResizing: () => boolean };
}

// ===== 列並び替え (ヘッダー grip ドラッグ) =====
// 干渉を避けるため、ドラッグソースは header 左端の grip アイコンに限定する。
// ドロップターゲットは header wrapper 全体で受け、左右どちらに落としたかで
// before / after を判定する。
const dragColumnId = ref<string | null>(null);
const dragOverColumnId = ref<string | null>(null);
const dragOverSide = ref<'before' | 'after' | null>(null);

const resetDragState = () => {
  dragColumnId.value = null;
  dragOverColumnId.value = null;
  dragOverSide.value = null;
};

/**
 * grip の dragstart 時に「列全体の縦長プレビュー」を作って setDragImage に渡す。
 * 既存の th と同じ幅で、そのまま上から数行ぶんのセルテキストを並べたゴースト。
 * ブラウザがゴーストを描画した直後 (次マイクロタスク) に DOM から取り除く。
 */
const buildColumnGhost = (grip: HTMLElement): HTMLElement | null => {
  const th = grip.closest('th');
  const table = th?.closest('table');
  if (!th || !table) return null;
  const cellIndex = Array.from(th.parentElement!.children).indexOf(th);
  if (cellIndex < 0) return null;

  const ghost = document.createElement('div');
  const thRect = th.getBoundingClientRect();
  const bg = getComputedStyle(table).backgroundColor || 'white';
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '-9999px',
    left: '-9999px',
    width: `${thRect.width}px`,
    background: bg,
    border: '1px solid rgba(99, 102, 241, 0.6)',
    borderRadius: '4px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
    overflow: 'hidden',
    fontSize: '12px',
  } as CSSStyleDeclaration);

  // ヘッダー部分
  const headDiv = document.createElement('div');
  Object.assign(headDiv.style, {
    padding: '4px 8px',
    background: 'rgba(99, 102, 241, 0.12)',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as CSSStyleDeclaration);
  headDiv.textContent = (th.textContent ?? '').trim();
  ghost.appendChild(headDiv);

  // 表示中の上から最大 5 行ぶんのセルテキストを抜粋
  const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
  for (let i = 0; i < Math.min(rows.length, 5); i += 1) {
    const td = rows[i]!.children[cellIndex] as HTMLElement | undefined;
    if (!td) continue;
    const row = document.createElement('div');
    Object.assign(row.style, {
      padding: '4px 8px',
      borderTop: '1px solid rgba(0,0,0,0.08)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as CSSStyleDeclaration);
    row.textContent = (td.textContent ?? '').trim().slice(0, 60);
    ghost.appendChild(row);
  }
  document.body.appendChild(ghost);
  return ghost;
};

const onGripDragStart = (e: DragEvent, columnId: string) => {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  // 一部ブラウザは setData 必須でないと dragend しか発火しないケースがある
  e.dataTransfer.setData('text/plain', columnId);

  const grip = e.currentTarget as HTMLElement;
  const ghost = buildColumnGhost(grip);
  if (ghost) {
    e.dataTransfer.setDragImage(ghost, 12, 12);
    // ブラウザがゴーストを画像化した直後に DOM から除去 (次マイクロタスク)
    setTimeout(() => ghost.remove(), 0);
  }

  dragColumnId.value = columnId;
};

const onHeaderDragOver = (e: DragEvent, columnId: string) => {
  if (!dragColumnId.value || dragColumnId.value === columnId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const midX = rect.left + rect.width / 2;
  dragOverColumnId.value = columnId;
  dragOverSide.value = e.clientX < midX ? 'before' : 'after';
};

const onHeaderDrop = (e: DragEvent, columnId: string) => {
  e.preventDefault();
  const src = dragColumnId.value;
  if (!src || src === columnId) {
    resetDragState();
    return;
  }
  const from = columnOrder.value.indexOf(src);
  let to = columnOrder.value.indexOf(columnId);
  if (from === -1 || to === -1) {
    resetDragState();
    return;
  }
  if (dragOverSide.value === 'after') to += 1;
  if (from < to) to -= 1;
  if (from === to) {
    resetDragState();
    return;
  }
  const next = [...columnOrder.value];
  next.splice(from, 1);
  next.splice(to, 0, src);
  columnOrder.value = next;
  resetDragState();
};

/** th 全幅をカバーする wrapper。左端に grip ドラッグ、右端にリサイズハンドルを配置 */
const wrapHeader = (children: unknown[], header: ResizeHeader) => {
  const isResizing = header.column.getIsResizing();
  const columnId = header.column.id;
  const showBefore = dragOverColumnId.value === columnId && dragOverSide.value === 'before';
  const showAfter = dragOverColumnId.value === columnId && dragOverSide.value === 'after';
  return h(
    'div',
    {
      class: 'relative flex items-center w-full min-w-0 overflow-hidden pr-2',
      onDragover: (e: DragEvent) => onHeaderDragOver(e, columnId),
      onDrop: (e: DragEvent) => onHeaderDrop(e, columnId),
      onDragend: resetDragState,
    },
    [
      h(UIcon, {
        name: 'i-lucide-grip-vertical',
        class:
          'shrink-0 mr-1 size-3.5 text-muted opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing',
        draggable: true,
        onDragstart: (e: DragEvent) => onGripDragStart(e, columnId),
        title: 'ドラッグで列を並べ替え',
      }),
      ...(children as never[]),
      h('div', {
        'data-resize-handle': columnId,
        class: [
          'absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none transition-colors',
          // 常時うっすら見える色にしておき、ホバー/ドラッグで強調する。
          isResizing ? 'bg-primary' : 'bg-accented hover:bg-primary/60',
        ].join(' '),
        onMousedown: (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          header.getResizeHandler()(e);
        },
        onTouchstart: header.getResizeHandler(),
        // ダブルクリックで左隣の列を内容に自動フィット
        onDblclick: (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          autoFitColumn(columnId);
        },
        title: 'ダブルクリックで内容に合わせて調整',
      }),
      // ドロップ位置インジケータ
      showBefore
        ? h('div', {
            class: 'absolute left-0 top-0 bottom-0 w-0.5 bg-primary pointer-events-none',
          })
        : null,
      showAfter
        ? h('div', {
            class: 'absolute right-0 top-0 bottom-0 w-0.5 bg-primary pointer-events-none',
          })
        : null,
    ],
  );
};

const sortHeader = (label: string) => {
  return ({ column, header }: { column: SortColumn; header: ResizeHeader }) => {
    const sorted = column.getIsSorted();
    return wrapHeader(
      [
        h(UButton, {
          color: 'neutral',
          variant: 'ghost',
          label,
          class: '-mx-2.5 min-w-0 data-[state=open]:bg-elevated',
          ui: { label: 'truncate min-w-0' },
          icon:
            sorted === 'asc'
              ? 'i-lucide-arrow-up'
              : sorted === 'desc'
                ? 'i-lucide-arrow-down'
                : 'i-lucide-arrow-up-down',
          onClick: () => column.toggleSorting(),
        }),
      ],
      header,
    );
  };
};

const plainHeader = (label: string) => {
  return ({ header }: { header: ResizeHeader }) =>
    wrapHeader([h('span', { class: 'text-sm truncate min-w-0' }, label)], header);
};

/** ソートボタンに加えて、漏斗アイコン + 日付範囲フィルタの Popover を持つヘッダ */
const sortAndDateFilterHeader = (
  label: string,
  active: ComputedRef<boolean>,
  range: Ref<DateRangeValue>,
) => {
  return ({ column, header }: { column: SortColumn; header: ResizeHeader }) => {
    const sorted = column.getIsSorted();
    return wrapHeader(
      [
        h(UButton, {
          color: 'neutral',
          variant: 'ghost',
          label,
          class: '-mx-2.5 min-w-0 data-[state=open]:bg-elevated',
          ui: { label: 'truncate min-w-0' },
          icon:
            sorted === 'asc'
              ? 'i-lucide-arrow-up'
              : sorted === 'desc'
                ? 'i-lucide-arrow-down'
                : 'i-lucide-arrow-up-down',
          onClick: () => column.toggleSorting(),
        }),
        h(
          UPopover,
          { ui: { content: 'p-0 w-auto' } },
          {
            default: () =>
              h(UButton, {
                color: active.value ? 'primary' : 'neutral',
                variant: active.value ? 'soft' : 'ghost',
                size: 'xs',
                icon: 'i-lucide-filter',
                'aria-label': `${label}の範囲でフィルタ`,
                class: 'ml-0.5 shrink-0',
              }),
            content: () =>
              h(DateRangeFilter, {
                modelValue: range.value,
                'onUpdate:modelValue': (v: DateRangeValue) => {
                  range.value = v;
                },
              }),
          },
        ),
      ],
      header,
    );
  };
};

/** リサイズハンドル配置用 + 列幅を th/td の style に反映する meta */
const RESIZABLE_META = {
  class: { th: 'relative' },
  style: {
    th: (header: { column: { id: string; getSize: () => number } }) => {
      const w = header.column.getSize();
      const isDragging = dragColumnId.value === header.column.id;
      return {
        width: `${w}px`,
        minWidth: `${w}px`,
        maxWidth: `${w}px`,
        ...(isDragging ? { opacity: '0.3' } : {}),
      };
    },
    td: (cell: { column: { id: string; getSize: () => number } }) => {
      const w = cell.column.getSize();
      const isDragging = dragColumnId.value === cell.column.id;
      return {
        width: `${w}px`,
        minWidth: `${w}px`,
        maxWidth: `${w}px`,
        ...(isDragging ? { opacity: '0.3' } : {}),
      };
    },
  },
} as const;

// 列幅の上限。手動ドラッグでも URL 由来でもこの値を超えさせない
// （巨大値でレイアウトを破壊されるのを防ぐ）。TanStack の getSize() が
// [minSize, maxSize] でクランプするため、各列に maxSize として付与する。
const COLUMN_MAX_WIDTH = 1000;

const columns: TableColumn<Task>[] = [
  { accessorKey: 'seq', header: sortHeader('No'), size: 64, minSize: 48, meta: RESIZABLE_META },
  {
    accessorKey: 'content',
    header: sortHeader('内容'),
    size: 360,
    minSize: 120,
    meta: RESIZABLE_META,
  },
  {
    accessorKey: 'assigneeMemberId',
    header: sortHeader('担当者'),
    size: 140,
    minSize: 80,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const na = memberMap.value[a.original.assigneeMemberId ?? '']?.displayName ?? '';
      const nb = memberMap.value[b.original.assigneeMemberId ?? '']?.displayName ?? '';
      return na.localeCompare(nb, 'ja');
    },
  },
  {
    accessorKey: 'statusCode',
    header: sortHeader('ステータス'),
    size: 140,
    minSize: 80,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const oa = statusMap.value[a.original.statusCode]?.order ?? 999;
      const ob = statusMap.value[b.original.statusCode]?.order ?? 999;
      return oa - ob;
    },
  },
  {
    accessorKey: 'priorityCode',
    header: sortHeader('優先度'),
    size: 100,
    minSize: 60,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const oa = a.original.priorityCode
        ? (priorityMap.value[a.original.priorityCode]?.order ?? 999)
        : 999;
      const ob = b.original.priorityCode
        ? (priorityMap.value[b.original.priorityCode]?.order ?? 999)
        : 999;
      return oa - ob;
    },
  },
  {
    accessorKey: 'tagCodes',
    header: plainHeader('タグ'),
    enableSorting: false,
    size: 200,
    minSize: 80,
    meta: RESIZABLE_META,
  },
  {
    accessorKey: 'flagCodes',
    header: plainHeader('フラグ'),
    enableSorting: false,
    size: 200,
    minSize: 80,
    meta: RESIZABLE_META,
  },
  {
    accessorKey: 'deadline',
    header: sortAndDateFilterHeader('期限', deadlineFilter.isActive, deadlineFilter.range),
    size: 120,
    minSize: 80,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const da = a.original.deadline ?? '9999-12-31';
      const db = b.original.deadline ?? '9999-12-31';
      return da.localeCompare(db);
    },
  },
  {
    accessorKey: 'plannedStartDate',
    header: sortAndDateFilterHeader(
      '着手予定日',
      plannedStartFilter.isActive,
      plannedStartFilter.range,
    ),
    size: 120,
    minSize: 80,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const da = a.original.plannedStartDate ?? '9999-12-31';
      const db = b.original.plannedStartDate ?? '9999-12-31';
      return da.localeCompare(db);
    },
  },
  {
    accessorKey: 'plannedCompletionDate',
    header: sortAndDateFilterHeader(
      '完了予定日',
      plannedCompletionFilter.isActive,
      plannedCompletionFilter.range,
    ),
    size: 120,
    minSize: 80,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const da = a.original.plannedCompletionDate ?? '9999-12-31';
      const db = b.original.plannedCompletionDate ?? '9999-12-31';
      return da.localeCompare(db);
    },
  },
  {
    accessorKey: 'plannedReleaseDate',
    header: sortAndDateFilterHeader(
      'リリース予定日',
      plannedReleaseFilter.isActive,
      plannedReleaseFilter.range,
    ),
    size: 120,
    minSize: 80,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const da = a.original.plannedReleaseDate ?? '9999-12-31';
      const db = b.original.plannedReleaseDate ?? '9999-12-31';
      return da.localeCompare(db);
    },
  },
  {
    accessorKey: 'requesterMemberId',
    header: sortHeader('起票者'),
    size: 140,
    minSize: 80,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const na = memberMap.value[a.original.requesterMemberId ?? '']?.displayName ?? '';
      const nb = memberMap.value[b.original.requesterMemberId ?? '']?.displayName ?? '';
      return na.localeCompare(nb, 'ja');
    },
  },
  {
    accessorKey: 'requestingDeptCode',
    header: sortHeader('依頼部署'),
    size: 120,
    minSize: 80,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const na = departmentMap.value[a.original.requestingDeptCode ?? '']?.name ?? '';
      const nb = departmentMap.value[b.original.requestingDeptCode ?? '']?.name ?? '';
      return na.localeCompare(nb, 'ja');
    },
  },
  {
    accessorKey: 'description',
    header: plainHeader('説明'),
    size: 280,
    minSize: 80,
    enableSorting: false,
    meta: RESIZABLE_META,
  },
  {
    accessorKey: 'links',
    header: plainHeader('リンク'),
    size: 120,
    minSize: 60,
    enableSorting: false,
    meta: RESIZABLE_META,
  },
  {
    accessorKey: 'completedAt',
    header: sortAndDateFilterHeader(
      '完了日時',
      completedAtFilter.isActive,
      completedAtFilter.range,
    ),
    size: 140,
    minSize: 100,
    meta: RESIZABLE_META,
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      // null は末尾に来るよう ZZZ で代用
      const da = a.original.completedAt ?? 'ZZZZ';
      const db = b.original.completedAt ?? 'ZZZZ';
      return da.localeCompare(db);
    },
  },
  {
    accessorKey: 'statusChangedAt',
    header: sortAndDateFilterHeader(
      'ステータス更新日時',
      statusChangedAtFilter.isActive,
      statusChangedAtFilter.range,
    ),
    size: 160,
    minSize: 100,
    meta: RESIZABLE_META,
  },
  {
    accessorKey: 'createdAt',
    header: sortAndDateFilterHeader('作成日時', createdAtFilter.isActive, createdAtFilter.range),
    size: 140,
    minSize: 100,
    meta: RESIZABLE_META,
  },
  {
    accessorKey: 'updatedAt',
    header: sortAndDateFilterHeader('更新日時', updatedAtFilter.isActive, updatedAtFilter.range),
    size: 140,
    minSize: 100,
    meta: RESIZABLE_META,
  },
];

// 全列に共通の最大幅を付与（個別指定があればそれを尊重）。
// これでヘッダーのドラッグリサイズも COLUMN_MAX_WIDTH で頭打ちになる。
for (const c of columns) {
  const col = c as { maxSize?: number };
  col.maxSize = col.maxSize ?? COLUMN_MAX_WIDTH;
}

// ソートもプロジェクトごとに localStorage 永続化（列幅と同じ流儀）。
// プロジェクトを切り替えて素の遷移で開いたとき、前回のソートを復元する。
// SavedView を選んだ場合はビューのソートが優先（フィルタ記憶と同じ思想）。
const sortMemoryKey = computed(() => `tasks:sort:${currentProjectId.value}`);
const savedSortQuery = (): Record<string, string> => {
  if (!import.meta.client) return {};
  try {
    const raw = localStorage.getItem(sortMemoryKey.value);
    if (!raw) return {};
    const s = JSON.parse(raw) as { sort?: string; sortDir?: string };
    if (!s.sort) return {};
    return { sort: s.sort, sortDir: s.sortDir === 'desc' ? 'desc' : 'asc' };
  } catch {
    return {};
  }
};

// 列幅は localStorage に永続化（プロジェクトごと）
const columnSizingKey = computed(() => `tasks:column-sizing:${currentProjectId.value}`);
const columnSizing = ref<Record<string, number>>({});
// columnSizingInfo はドラッグ中の状態。永続化は不要だが v-model に渡さないと
// onColumnSizingInfoChange が hook されず、ドラッグ中の更新が反映されない。
const columnSizingInfo = ref<ColumnSizingInfoState>({
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: [],
});

// 列リサイズ中、ヘッダのリサイズバーの中心に列全体（ヘッダ〜全行）を貫く
// ガイド線を出す。カーソル X ではなくハンドルの実描画位置を毎フレーム読むので、
// minSize でのクランプ等で移動幅が大きくなってもヘッダの線とズレない。
const tableRef = useTemplateRef<{ $el?: HTMLElement }>('tableRef');
const resizeGuide = ref<{ x: number; top: number; height: number } | null>(null);
const resizingColumnId = computed(() => {
  const id = columnSizingInfo.value.isResizingColumn;
  return id === false ? null : id;
});

let resizeRaf = 0;
const syncResizeGuide = () => {
  const root = tableRef.value?.$el;
  const colId = resizingColumnId.value;
  if (root && colId) {
    const handle = root.querySelector<HTMLElement>(`[data-resize-handle="${colId}"]`);
    if (handle) {
      const tableRect = root.getBoundingClientRect();
      const handleRect = handle.getBoundingClientRect();
      resizeGuide.value = {
        // ハンドル（バー）の中心 X に合わせる
        x: handleRect.left + handleRect.width / 2,
        top: tableRect.top,
        height: tableRect.height,
      };
    }
  }
  if (resizingColumnId.value) resizeRaf = requestAnimationFrame(syncResizeGuide);
};

watch(resizingColumnId, (colId) => {
  if (!import.meta.client) return;
  cancelAnimationFrame(resizeRaf);
  if (colId) {
    resizeRaf = requestAnimationFrame(syncResizeGuide);
  } else {
    resizeGuide.value = null;
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) cancelAnimationFrame(resizeRaf);
});

// 自動フィットの上限。長文セルでも列が画面外まで広がって破綻しないよう必ずクランプする。
const AUTO_FIT_MAX_WIDTH = 600;
const AUTO_FIT_PADDING = 4;

/**
 * セルの中身を画面外に複製し、幅制約（table-fixed / truncate / w-full 等）を
 * 外した自然幅を実測する。padding 込みの必要幅を返す。
 */
const measureCellContentWidth = (measureHost: HTMLElement, cell: HTMLElement): number => {
  const cs = getComputedStyle(cell);
  const padX = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0');
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:inline-flex;align-items:center;white-space:nowrap;';
  // フォントはクラス由来でも効くが、テキストノード直下のセル用に明示コピーしておく
  wrapper.style.fontFamily = cs.fontFamily;
  wrapper.style.fontSize = cs.fontSize;
  wrapper.style.fontWeight = cs.fontWeight;
  wrapper.style.letterSpacing = cs.letterSpacing;
  for (const child of Array.from(cell.childNodes)) {
    wrapper.appendChild(child.cloneNode(true));
  }
  for (const el of Array.from(wrapper.querySelectorAll<HTMLElement>('*'))) {
    el.style.width = 'auto';
    el.style.minWidth = '0';
    el.style.maxWidth = 'none';
    el.style.overflow = 'visible';
    el.style.whiteSpace = 'nowrap';
    el.style.flex = 'none';
    // ヘッダのソートボタンの -mx-2.5 など、負マージンで幅が過小評価されるのを防ぐ
    el.style.margin = '0';
  }
  measureHost.appendChild(wrapper);
  const width = wrapper.getBoundingClientRect().width;
  measureHost.removeChild(wrapper);
  return Math.ceil(width + padX + AUTO_FIT_PADDING);
};

/** ダブルクリックされた列を、ヘッダ＋表示中セルの内容幅に自動フィットする。 */
const autoFitColumn = (colId: string) => {
  if (!import.meta.client) return;
  const root = tableRef.value?.$el;
  if (!root) return;
  const handle = root.querySelector<HTMLElement>(`[data-resize-handle="${colId}"]`);
  const th = handle?.closest('th');
  if (!th) return;
  const ths = Array.from(root.querySelectorAll('thead th'));
  const index = ths.indexOf(th);
  if (index < 0) return;

  // 画面外の計測用ホスト（クラスを効かせるため document 内に置く）
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;';
  document.body.appendChild(host);
  try {
    let max = measureCellContentWidth(host, th);
    for (const tr of Array.from(root.querySelectorAll('tbody tr'))) {
      const td = tr.children[index];
      if (td instanceof HTMLElement) {
        max = Math.max(max, measureCellContentWidth(host, td));
      }
    }
    const minSize =
      (
        columns.find(
          (c) =>
            ((c as { accessorKey?: string; id?: string }).accessorKey ??
              (c as { id?: string }).id) === colId,
        ) as { minSize?: number } | undefined
      )?.minSize ?? 48;
    const next = Math.min(Math.max(max, minSize), AUTO_FIT_MAX_WIDTH);
    columnSizing.value = { ...columnSizing.value, [colId]: next };
  } finally {
    document.body.removeChild(host);
  }
};

// 列の表示/非表示もプロジェクトごとに localStorage 永続化
const columnVisibilityKey = computed(() => `tasks:column-visibility:${currentProjectId.value}`);
const columnVisibility = ref<Record<string, boolean>>({});

// 列順序も同じくプロジェクトごとに localStorage 永続化
const columnOrderKey = computed(() => `tasks:column-order:${currentProjectId.value}`);
const DEFAULT_COLUMN_ORDER: string[] = columns.map(
  (c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id: string }).id,
);
/**
 * 保存値と現行列定義をマージする。
 * - 保存値の順序を尊重しつつ、存在しなくなったキーは除外
 * - 新しく増えた列は末尾に追加（過去ユーザーでもデフォルト位置に出てくる）
 */
const mergeColumnOrder = (saved: string[] | null): string[] => {
  if (!saved) return [...DEFAULT_COLUMN_ORDER];
  const valid = saved.filter((k) => DEFAULT_COLUMN_ORDER.includes(k));
  const missing = DEFAULT_COLUMN_ORDER.filter((k) => !valid.includes(k));
  return [...valid, ...missing];
};
const columnOrder = ref<string[]>([...DEFAULT_COLUMN_ORDER]);

// ドロップダウンに出す日本語ラベル
const COLUMN_LABELS: Record<string, string> = {
  seq: 'No',
  content: '内容',
  assigneeMemberId: '担当者',
  statusCode: 'ステータス',
  priorityCode: '優先度',
  tagCodes: 'タグ',
  flagCodes: 'フラグ',
  deadline: '期限',
  plannedStartDate: '着手予定日',
  plannedCompletionDate: '完了予定日',
  plannedReleaseDate: 'リリース予定日',
  requesterMemberId: '起票者',
  requestingDeptCode: '依頼部署',
  description: '説明',
  links: 'リンク',
  completedAt: '完了日時',
  statusChangedAt: 'ステータス更新日時',
  createdAt: '作成日時',
  updatedAt: '更新日時',
};

/** デフォルトで非表示にする列（ユーザーが切り替えれば永続化） */
const DEFAULT_HIDDEN_COLUMNS: Record<string, boolean> = {
  plannedStartDate: false,
  plannedCompletionDate: false,
  plannedReleaseDate: false,
  requesterMemberId: false,
  requestingDeptCode: false,
  description: false,
  links: false,
  completedAt: false,
  statusChangedAt: false,
  createdAt: false,
  updatedAt: false,
};

// ===== 列レイアウト（表示列 / 列順 / 列幅）を URL クエリに載せる =====
// cols = 可視列をその順に並べたもの（表示/非表示と列順を 1 パラメータで表現）。
// colw = 列幅を key:px のカンマ区切り（リサイズした列だけ）。
// 優先順位は URL > localStorage > 既定。URL 由来で適用する間（初期化含む）は
// localStorage / URL への書き戻しを抑止する（共有リンクを開いただけで個人の
// 既定を上書きしたり、URL を勝手に汚したりしないため）。
let applyingColumnLayout = false;

const DEFAULT_VISIBLE_ORDER = DEFAULT_COLUMN_ORDER.filter(
  (k) => DEFAULT_HIDDEN_COLUMNS[k] !== false,
);

/** 現在の列順 × 表示状態から「可視列をその順に並べた配列」を得る */
const visibleColumnsInOrder = (): string[] =>
  columnOrder.value.filter((k) => columnVisibility.value[k] !== false);

/** cols クエリ値。既定レイアウトと一致するときは undefined（URL を汚さない） */
const colsQueryValue = (): string | undefined => {
  const visible = visibleColumnsInOrder();
  return arraysEqual(visible, DEFAULT_VISIBLE_ORDER) ? undefined : visible.join(',');
};

/** colw クエリ値。リサイズ済みの列が無ければ undefined */
const colwQueryValue = (): string | undefined => {
  const entries = Object.entries(columnSizing.value);
  if (entries.length === 0) return undefined;
  // 生 state はドラッグ中に上限を超え得るので、URL に出す値も頭打ちにする
  return entries.map(([k, w]) => `${k}:${Math.min(Math.round(w), COLUMN_MAX_WIDTH)}`).join(',');
};

/** cols クエリ → columnOrder / columnVisibility に反映（URL が表示列を完全に規定する） */
const applyColsFromQuery = (raw: string) => {
  const listed = raw.split(',').filter((k) => DEFAULT_COLUMN_ORDER.includes(k));
  if (listed.length === 0) return;
  const hidden = DEFAULT_COLUMN_ORDER.filter((k) => !listed.includes(k));
  columnOrder.value = [...listed, ...hidden];
  columnVisibility.value = Object.fromEntries(
    DEFAULT_COLUMN_ORDER.map((k) => [k, listed.includes(k)]),
  );
};

/** 列ごとの minSize（列定義由来）。URL 由来の幅クランプに使う */
const COLUMN_MIN_SIZE: Record<string, number> = Object.fromEntries(
  columns.map((c) => [
    (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id: string }).id,
    (c as { minSize?: number }).minSize ?? 48,
  ]),
);

/** colw クエリ → columnSizing に反映。値は [minSize, COLUMN_MAX_WIDTH] にクランプ */
const applyColwFromQuery = (raw: string) => {
  const next: Record<string, number> = {};
  for (const pair of raw.split(',')) {
    const [k, w] = pair.split(':');
    const n = Number(w);
    if (!k || !DEFAULT_COLUMN_ORDER.includes(k) || !Number.isFinite(n)) continue;
    // 巨大値 / 負値 / 過小値はクランプして弾く（?colw=foo:999999 等での破壊を防ぐ）
    const min = COLUMN_MIN_SIZE[k] ?? 48;
    next[k] = Math.min(Math.max(Math.round(n), min), COLUMN_MAX_WIDTH);
  }
  columnSizing.value = next;
};

/** URL クエリ（cols / colw）から列レイアウトを適用する。適用中は書き戻しを抑止 */
const applyColumnLayoutFromQuery = () => {
  applyingColumnLayout = true;
  const colsQ = queryString('cols');
  if (colsQ) applyColsFromQuery(colsQ);
  const colwQ = queryString('colw');
  if (colwQ) applyColwFromQuery(colwQ);
  void nextTick(() => {
    applyingColumnLayout = false;
  });
};

/** 現在の列レイアウトを URL クエリへ同期（変化があるときだけ replace） */
const syncColumnLayoutToUrl = () => {
  const cols = colsQueryValue();
  const colw = colwQueryValue();
  const changes: Record<string, string | undefined> = {};
  if ((queryString('cols') || undefined) !== cols) changes.cols = cols;
  if ((queryString('colw') || undefined) !== colw) changes.colw = colw;
  if (Object.keys(changes).length > 0) updateQuery(changes);
};

const columnVisibilityItems = computed<DropdownMenuItem[]>(() =>
  Object.entries(COLUMN_LABELS).map(([key, label]) => ({
    label,
    type: 'checkbox',
    checked: columnVisibility.value[key] !== false,
    onUpdateChecked: (checked: boolean) => {
      columnVisibility.value = { ...columnVisibility.value, [key]: checked };
    },
    onSelect: (e: Event) => e.preventDefault(),
  })),
);

onMounted(() => {
  if (!import.meta.client) return;
  // 初期化中は localStorage / URL への書き戻しを抑止する。
  applyingColumnLayout = true;

  // 選択中ビューの復元。
  // - URL に ?view=:id があれば（選択後の状態 / 共有リンク）それを選択中として復元する。
  //   さらに列/フィルタ等の状態が URL に無ければ config を適用して再現する（共有リンク直後）。
  //   状態が URL にあるならそれを正とし、選択だけ復元して下の URL 復元へ進む（編集中の dirty を保つ）。
  // - ?view が無く、状態も無い素の遷移なら「前回使ったビュー」を再現する。
  const viewIdInUrl = queryString('view');
  const hasUrlState = urlHasViewState();
  // 画面間で記憶した「現在のフィルタ」。null=記憶なし / {}=クリア済み。
  const savedFilters = readSavedTaskFilters(currentProjectId.value);
  if (viewIdInUrl) {
    const view = savedViews.value.find((v) => v.id === viewIdInUrl);
    if (view) {
      selectedViewId.value = view.id;
      if (!hasUrlState) {
        // 共有リンク（?view のみ）: ビューを保存どおり再現
        // applyViewConfig 内で applyingColumnLayout のリセットまで行う
        applyViewConfig(view.config, view.id);
        return;
      }
    }
  } else if (!hasUrlState) {
    const lastId = localStorage.getItem(lastViewKey.value);
    const view = lastId ? savedViews.value.find((v) => v.id === lastId) : null;
    if (view) {
      selectedViewId.value = view.id;
      // 列/ソート/選択はビュー、フィルタは記憶した現在値を優先（変更後の絞り込みを保つ）
      const config = savedFilters ? { ...view.config, filters: savedFilters } : view.config;
      applyViewConfig(config, view.id);
      return;
    }
    // ビュー未選択でも、記憶したフィルタ・ソートがあれば復元（列は下の localStorage 復元に任せる）
    const restore = {
      ...(savedFilters && Object.keys(savedFilters).length > 0 ? savedFilters : {}),
      ...savedSortQuery(),
    };
    if (Object.keys(restore).length > 0) {
      updateQuery(restore);
    }
  }

  // 列幅: URL(colw) > localStorage
  const colwQ = queryString('colw');
  if (colwQ) {
    applyColwFromQuery(colwQ);
  } else {
    try {
      const raw = localStorage.getItem(columnSizingKey.value);
      if (raw) columnSizing.value = JSON.parse(raw) as Record<string, number>;
    } catch {
      // ignore
    }
  }

  // 表示列 + 列順: URL(cols) > localStorage
  const colsQ = queryString('cols');
  if (colsQ) {
    applyColsFromQuery(colsQ);
  } else {
    try {
      const raw = localStorage.getItem(columnVisibilityKey.value);
      const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
      // 既存ユーザーの保存値に後から増えた列のキーが含まれないため、
      // DEFAULT_HIDDEN_COLUMNS を下敷きにして保存値で上書きする
      // （明示的に表示/非表示を選んでいればそちらを優先）。
      columnVisibility.value = { ...DEFAULT_HIDDEN_COLUMNS, ...(stored ?? {}) };
    } catch {
      columnVisibility.value = { ...DEFAULT_HIDDEN_COLUMNS };
    }
    try {
      const raw = localStorage.getItem(columnOrderKey.value);
      const stored = raw ? (JSON.parse(raw) as string[]) : null;
      columnOrder.value = mergeColumnOrder(stored);
    } catch {
      columnOrder.value = [...DEFAULT_COLUMN_ORDER];
    }
  }

  void nextTick(() => {
    applyingColumnLayout = false;
  });
});

watch(
  columnSizing,
  (v) => {
    // ドラッグ中は per-frame の setItem を避け、完了時にまとめて永続化する（下の watcher）
    if (!import.meta.client || applyingColumnLayout || resizingColumnId.value) return;
    localStorage.setItem(columnSizingKey.value, JSON.stringify(v));
  },
  { deep: true },
);

watch(
  columnVisibility,
  (v) => {
    if (!import.meta.client || applyingColumnLayout) return;
    localStorage.setItem(columnVisibilityKey.value, JSON.stringify(v));
  },
  { deep: true },
);

watch(
  columnOrder,
  (v) => {
    if (!import.meta.client || applyingColumnLayout) return;
    localStorage.setItem(columnOrderKey.value, JSON.stringify(v));
  },
  { deep: true },
);

// ソートをプロジェクトごとに保存（未ソートはキー削除）
watch(
  sorting,
  (v) => {
    if (!import.meta.client || applyingColumnLayout) return;
    if (v.length > 0) {
      localStorage.setItem(
        sortMemoryKey.value,
        JSON.stringify({ sort: v[0]!.id, sortDir: v[0]!.desc ? 'desc' : 'asc' }),
      );
    } else {
      localStorage.removeItem(sortMemoryKey.value);
    }
  },
  { deep: true },
);

// 列レイアウトの変更を URL へ同期（localStorage への保存は上の watcher が担当）。
// リサイズ中は columnSizing が毎フレーム更新されるため、ドラッグ中は URL 書き換え
// （router.replace）を抑止し、ドラッグ完了時にまとめて 1 回だけ同期する。
watch(
  [columnVisibility, columnOrder, columnSizing],
  () => {
    if (!import.meta.client || applyingColumnLayout || resizingColumnId.value) return;
    syncColumnLayoutToUrl();
  },
  { deep: true },
);

// リサイズ完了（ドラッグ終了）時に、列幅を localStorage と URL へまとめて反映する
watch(resizingColumnId, (id, prev) => {
  if (!import.meta.client || applyingColumnLayout) return;
  if (prev && !id) {
    localStorage.setItem(columnSizingKey.value, JSON.stringify(columnSizing.value));
    syncColumnLayoutToUrl();
  }
});

// 戻る/進む・共有リンクで URL が外から変わったら列レイアウトを合わせる。
// 既に現在の状態と一致していれば何もしない（自分の URL 書き込みで来たケース）。
watch(
  () => [queryString('cols'), queryString('colw')] as const,
  ([cols, colw]) => {
    if (!import.meta.client || applyingColumnLayout) return;
    if ((colsQueryValue() ?? '') === cols && (colwQueryValue() ?? '') === colw) return;
    applyColumnLayoutFromQuery();
  },
);

// ===== 保存ビュー (SavedView) =====
// 表示状態は全て URL クエリにシリアライズされている。capture = クエリ + 列 ref の
// 読み取り、apply = 列 ref を直接セット + フィルタ/ソートを URL へ全置換。
const { me, isReadonly } = useAuth();
const currentTenantKey = useCurrentTenantKey();

const lastViewKey = computed(() => `tasks:last-view:${currentProjectId.value}`);
const selectedViewId = ref<string | null>(null);

// 孤児化した共有ビュー（owner=null）を引き取れる権限（テナント admin or プロジェクト admin）
const canManageShared = computed(() => {
  if (me.value?.role === 'admin') return true;
  const uid = currentUserId.value;
  return members.value.some((m) => m.userId === uid && m.role === 'admin');
});

// capture/apply 対象のフィルタ系クエリキー
const FILTER_QUERY_KEYS = [
  'search',
  'status',
  'priority',
  'assignee',
  'tag',
  'flag',
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
] as const;

const VIEW_STATE_KEYS = ['cols', 'colw', 'sort', 'sortDir', ...FILTER_QUERY_KEYS];

/** URL に表示状態（列/フィルタ/ソート）が載っているか。共有リンクで開いたケースの判定に使う */
const urlHasViewState = (): boolean => VIEW_STATE_KEYS.some((k) => queryString(k));

/** 現在の表示状態を SavedViewConfig に取り出す */
const captureViewConfig = (): SavedViewConfig => {
  const filters: Record<string, string> = {};
  for (const k of FILTER_QUERY_KEYS) {
    const v = queryString(k);
    if (v) filters[k] = v;
  }
  const sortId = queryString('sort');
  return {
    columns: {
      order: [...columnOrder.value],
      visibility: { ...columnVisibility.value },
      sizing: { ...columnSizing.value },
    },
    filters,
    sort: sortId
      ? { columnId: sortId, dir: queryString('sortDir') === 'desc' ? 'desc' : 'asc' }
      : null,
  };
};

/**
 * SavedViewConfig を表示状態へ適用（列は ref を直接、フィルタ/ソート/列クエリは URL を全置換）。
 * viewId を渡すと選択中ビューとして URL に `?view=:id` を残し、リロードでも選択を復元できる。
 */
const applyViewConfig = (config: SavedViewConfig, viewId?: string) => {
  applyingColumnLayout = true;
  columnOrder.value = mergeColumnOrder(config.columns.order);
  columnVisibility.value = { ...DEFAULT_HIDDEN_COLUMNS, ...config.columns.visibility };
  columnSizing.value = { ...config.columns.sizing };

  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.filters)) {
    if (v) query[k] = String(v);
  }
  if (config.sort) {
    query.sort = config.sort.columnId;
    query.sortDir = config.sort.dir;
  }
  const cols = colsQueryValue();
  if (cols) query.cols = cols;
  const colw = colwQueryValue();
  if (colw) query.colw = colw;
  if (viewId) query.view = viewId;
  const task = queryString('task');
  if (task) query.task = task;
  void router.replace({ query });
  void nextTick(() => {
    applyingColumnLayout = false;
  });
};

/**
 * dirty 判定用の正規化。URL 経由のラウンドトリップ（cols=可視列のみ / colw=丸め・クランプ）
 * で表現が変わっても一致するよう、「URL に載る実質的な形」へ寄せて比較する。
 * - 列は可視列の順序のみ（非表示列の順序は URL に載らないので無視）
 * - 列幅は colw と同じく丸め＋[min, max] クランプ
 */
const canonConfig = (c: SavedViewConfig): string => {
  const sortEntries = (o: Record<string, unknown>) =>
    Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
  const visible = c.columns.order.filter((k) => c.columns.visibility[k] !== false);
  const sizing = Object.fromEntries(
    sortEntries(c.columns.sizing).map(([k, w]) => {
      const min = COLUMN_MIN_SIZE[k] ?? 48;
      return [k, Math.min(Math.max(Math.round(Number(w)), min), COLUMN_MAX_WIDTH)];
    }),
  );
  return JSON.stringify({
    visible,
    sizing,
    filters: Object.fromEntries(sortEntries(c.filters)),
    sort: c.sort,
  });
};

/** 現在の状態が選択中ビューと異なるか（未保存の変更インジケータ用） */
const dirty = computed(() => {
  const view = savedViews.value.find((v) => v.id === selectedViewId.value);
  if (!view) return false;
  return canonConfig(view.config) !== canonConfig(captureViewConfig());
});

const selectView = (id: string) => {
  const view = savedViews.value.find((v) => v.id === id);
  if (!view) return;
  selectedViewId.value = id;
  if (import.meta.client) localStorage.setItem(lastViewKey.value, id);
  applyViewConfig(view.config, view.id);
};

/** 選択を解除しハードコード既定へ戻す */
const clearView = () => {
  selectedViewId.value = null;
  if (import.meta.client) localStorage.removeItem(lastViewKey.value);
  applyingColumnLayout = true;
  columnOrder.value = [...DEFAULT_COLUMN_ORDER];
  columnVisibility.value = { ...DEFAULT_HIDDEN_COLUMNS };
  columnSizing.value = {};
  const task = queryString('task');
  void router.replace({ query: task ? { task } : {} });
  void nextTick(() => {
    applyingColumnLayout = false;
  });
};

const saveCurrentView = async () => {
  const id = selectedViewId.value;
  if (!id) return;
  try {
    await apiUpdateSavedView(api, currentProjectId.value, id, { config: captureViewConfig() });
    await refreshSavedViews();
    toast.add({ title: 'ビューを保存しました', color: 'success' });
  } catch {
    toast.add({ title: 'ビューの保存に失敗しました', color: 'error' });
  }
};

const createView = async (payload: { name: string; visibility: SavedViewVisibility }) => {
  try {
    const created = await apiCreateSavedView(api, currentProjectId.value, {
      name: payload.name,
      visibility: payload.visibility,
      config: captureViewConfig(),
    });
    await refreshSavedViews();
    selectedViewId.value = created.id;
    if (import.meta.client) localStorage.setItem(lastViewKey.value, created.id);
    toast.add({ title: 'ビューを作成しました', color: 'success' });
  } catch {
    toast.add({ title: 'ビューの作成に失敗しました', color: 'error' });
  }
};

const renameView = async (payload: {
  id: string;
  name: string;
  visibility: SavedViewVisibility;
}) => {
  try {
    await apiUpdateSavedView(api, currentProjectId.value, payload.id, {
      name: payload.name,
      visibility: payload.visibility,
    });
    await refreshSavedViews();
    toast.add({ title: 'ビューを更新しました', color: 'success' });
  } catch {
    toast.add({ title: 'ビューの更新に失敗しました', color: 'error' });
  }
};

const duplicateView = async (id: string) => {
  try {
    const copy = await apiDuplicateSavedView(api, currentProjectId.value, id);
    await refreshSavedViews();
    selectView(copy.id);
    toast.add({ title: 'ビューを複製しました', color: 'success' });
  } catch {
    toast.add({ title: 'ビューの複製に失敗しました', color: 'error' });
  }
};

/** 共有ビューの短縮リンクをクリップボードへコピーする */
const shareView = async (view: SavedView) => {
  const url = `${window.location.origin}/${currentTenantKey.value}/v/${view.shortCode}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.add({
      title: 'ビューのリンクをコピーしました',
      color: 'success',
      icon: 'i-lucide-check',
    });
  } catch {
    toast.add({ title: 'コピーに失敗しました', color: 'error' });
  }
};

const deleteView = async (id: string) => {
  try {
    await apiDeleteSavedView(api, currentProjectId.value, id);
    if (selectedViewId.value === id) {
      selectedViewId.value = null;
      if (import.meta.client) localStorage.removeItem(lastViewKey.value);
    }
    await refreshSavedViews();
    toast.add({ title: 'ビューを削除しました', color: 'success' });
  } catch {
    toast.add({ title: 'ビューの削除に失敗しました', color: 'error' });
  }
};

const updateTaskField = async (
  taskId: string,
  patch: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt' | 'seq'>>,
) => {
  try {
    const updated = await apiUpdateTask(api, currentProjectId.value, taskId, patch);
    // 開いているタスクなら、再取得で一覧から外れても詳細が最新を保てるようキャッシュ更新
    if (openTaskCache.value?.id === updated.id) openTaskCache.value = updated;
    await refreshTasks();
  } catch (e) {
    // バリデーション（400）等の理由をそのままトーストで見せる
    const message = (e as { data?: { message?: string } }).data?.message;
    toast.add({ title: 'タスクを更新できませんでした', description: message, color: 'error' });
  }
};

// ===== 一括編集: 行選択 =====
// 選択は task.id の Set で保持（フィルタや並び替えに依らず行を特定できる）。
// 「全選択 = 現在のフィルタ結果すべて」とし、実際の操作対象もフィルタ結果に限定する
// （選択後にフィルタを絞った場合、表示外のタスクは対象にしない）。
const selectedTaskIds = ref<Set<string>>(new Set());

const isTaskSelected = (id: string): boolean => selectedTaskIds.value.has(id);
const toggleTaskSelected = (id: string, on: boolean) => {
  if (on) selectedTaskIds.value.add(id);
  else selectedTaskIds.value.delete(id);
};

// 操作対象 = 選択済み ∩ 表示中のタスク行（子は一括編集対象外）
const targetTaskIds = computed(() =>
  visibleTasks.value.filter((t) => selectedTaskIds.value.has(t.id)).map((t) => t.id),
);
const selectedCount = computed(() => targetTaskIds.value.length);

const allVisibleSelected = computed(
  () => visibleTasks.value.length > 0 && selectedCount.value === visibleTasks.value.length,
);
const someVisibleSelected = computed(() => selectedCount.value > 0 && !allVisibleSelected.value);

const toggleSelectAll = (on: boolean) => {
  for (const t of visibleTasks.value) {
    if (on) selectedTaskIds.value.add(t.id);
    else selectedTaskIds.value.delete(t.id);
  }
};
const clearSelection = () => selectedTaskIds.value.clear();

// ===== 一括編集: ダイアログ =====
const bulkEditOpen = ref(false);
const bulkApplying = ref(false);

const applyBulkEdit = async (patch: Omit<BulkUpdateTasksInput, 'ids'>) => {
  const ids = targetTaskIds.value;
  if (ids.length === 0) return;
  bulkApplying.value = true;
  try {
    const { updated } = await apiBulkUpdateTasks(api, currentProjectId.value, { ids, ...patch });
    toast.add({
      title: `${updated} 件のタスクを更新しました`,
      color: 'success',
      icon: 'i-lucide-check',
    });
    bulkEditOpen.value = false;
    clearSelection();
    await refreshTasks();
  } catch {
    toast.add({ title: '一括編集に失敗しました', color: 'error' });
  } finally {
    bulkApplying.value = false;
  }
};

const isOverdue = (task: Task): boolean =>
  (currentProject.value?.highlightOverdueDeadline ?? false) &&
  isTaskDatePast(task.deadline, task.statusCode, statusMap.value);

const isPlannedStartOverdue = (task: Task): boolean =>
  (currentProject.value?.highlightOverduePlannedStart ?? false) &&
  isTaskDatePast(task.plannedStartDate, task.statusCode, statusMap.value);

const isPlannedCompletionOverdue = (task: Task): boolean =>
  (currentProject.value?.highlightOverduePlannedCompletion ?? false) &&
  isTaskDatePast(task.plannedCompletionDate, task.statusCode, statusMap.value);

const isPlannedReleaseOverdue = (task: Task): boolean =>
  (currentProject.value?.highlightOverduePlannedRelease ?? false) &&
  isTaskDatePast(task.plannedReleaseDate, task.statusCode, statusMap.value);
</script>

<template>
  <UDashboardPanel id="tasks">
    <template #header>
      <UDashboardNavbar title="タスク一覧" icon="i-lucide-list-checks">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <TaskViewSwitcher
            :views="savedViews"
            :selected-view-id="selectedViewId"
            :current-user-id="currentUserId"
            :can-manage-shared="canManageShared"
            :dirty="dirty"
            @select="selectView"
            @clear="clearView"
            @save="saveCurrentView"
            @save-as="createView"
            @rename="renameView"
            @duplicate="duplicateView"
            @share="shareView"
            @delete="deleteView"
          />
          <UButton
            color="neutral"
            variant="outline"
            :icon="colorModeIcon"
            :aria-label="colorModeAriaLabel"
            @click="toggleColorMode"
          />
          <UDropdownMenu :items="columnVisibilityItems" :ui="{ content: 'min-w-40' }">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-columns-3"
              label="表示列"
              trailing-icon="i-lucide-chevron-down"
            />
          </UDropdownMenu>
          <UPopover :ui="{ content: 'p-2 w-64' }">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-arrow-left-right"
              label="列順"
              trailing-icon="i-lucide-chevron-down"
            />
            <template #content>
              <p class="text-xs text-muted px-2 pt-1 pb-2">ドラッグで列の並び順を変更</p>
              <VueDraggable
                v-model="columnOrder"
                :animation="150"
                handle=".drag-handle"
                class="space-y-0.5"
              >
                <div
                  v-for="key in columnOrder"
                  :key="key"
                  class="flex items-center gap-2 px-2 py-1 rounded hover:bg-elevated/40"
                >
                  <UIcon
                    name="i-lucide-grip-vertical"
                    class="drag-handle cursor-move size-4 text-muted shrink-0"
                  />
                  <span class="text-sm truncate">{{ COLUMN_LABELS[key] ?? key }}</span>
                </div>
              </VueDraggable>
            </template>
          </UPopover>
          <UButton
            v-if="!isReadonly"
            color="neutral"
            variant="outline"
            icon="i-lucide-bookmark"
            label="フラグ操作"
            @click="flagOpsOpen = true"
          />
          <UButton
            v-if="!isReadonly"
            color="primary"
            icon="i-lucide-plus"
            label="新規タスク"
            @click="createSlideoverOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EmptyState
        v-if="tasks.length === 0"
        icon="i-lucide-list-checks"
        title="タスクがまだありません"
        description="最初のタスクを追加して進捗を記録しましょう"
      >
        <UButton
          v-if="!isReadonly"
          color="primary"
          icon="i-lucide-plus"
          label="新規タスク"
          @click="createSlideoverOpen = true"
        />
      </EmptyState>

      <template v-else>
        <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-default">
          <UInput
            v-model="search"
            placeholder="内容を検索"
            icon="i-lucide-search"
            class="min-w-64"
            :ui="{ trailing: 'pe-1' }"
          >
            <template v-if="search" #trailing>
              <UButton
                icon="i-lucide-x"
                size="sm"
                color="neutral"
                variant="ghost"
                aria-label="検索内容をクリア"
                @click="search = ''"
              />
            </template>
          </UInput>
          <div class="flex items-center gap-1">
            <USelectMenu
              v-model="statusFilter"
              :items="statusSelectItems"
              value-key="value"
              multiple
              placeholder="すべてのステータス"
              class="w-44"
            />
            <UButton
              v-if="statusFilter.length > 0"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="ステータスフィルタをクリア"
              @click="statusFilter = []"
            />
          </div>
          <div class="flex items-center gap-1">
            <USelectMenu
              v-model="priorityFilter"
              :items="prioritySelectItems"
              value-key="value"
              multiple
              placeholder="すべての優先度"
              class="w-40"
            />
            <UButton
              v-if="priorityFilter.length > 0"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="優先度フィルタをクリア"
              @click="priorityFilter = []"
            />
          </div>
          <div class="flex items-center gap-1">
            <USelectMenu
              v-model="assigneeFilter"
              :items="assigneeFilterItems"
              value-key="value"
              multiple
              placeholder="すべての担当者"
              icon="i-lucide-user"
              searchable
              search-placeholder="名前で検索…"
              class="w-44"
            />
            <UButton
              v-if="assigneeFilter.length > 0"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="担当者フィルタをクリア"
              @click="assigneeFilter = []"
            />
          </div>
          <div class="flex items-center gap-1">
            <USelectMenu
              v-model="tagFilter"
              :items="tagFilterItems"
              value-key="value"
              multiple
              placeholder="すべてのタグ"
              icon="i-lucide-tag"
              searchable
              search-placeholder="タグ名で検索…"
              class="w-44"
            />
            <UButton
              v-if="tagFilter.length > 0"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="タグフィルタをクリア"
              @click="tagFilter = []"
            />
          </div>
          <div class="flex items-center gap-1">
            <USelectMenu
              v-model="flagFilter"
              :items="flagFilterItems"
              value-key="value"
              multiple
              placeholder="すべてのフラグ"
              icon="i-lucide-bookmark"
              searchable
              search-placeholder="フラグ名で検索…"
              class="w-44"
            />
            <UButton
              v-if="flagFilter.length > 0"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="フラグフィルタをクリア"
              @click="flagFilter = []"
            />
          </div>
          <UCheckbox
            v-model="showCompleted"
            label="完了も表示"
            :disabled="statusFilter.length > 0"
          />
          <UButton
            v-if="hasActiveFilter"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            label="すべてクリア"
            @click="resetFilters"
          />
          <UCheckbox
            v-if="!isReadonly"
            class="ml-auto"
            :model-value="someVisibleSelected ? 'indeterminate' : allVisibleSelected"
            :disabled="visibleTasks.length === 0"
            label="全選択"
            @update:model-value="(v: boolean | 'indeterminate') => toggleSelectAll(v === true)"
          />
          <span class="text-sm text-muted" :class="isReadonly ? 'ml-auto' : ''">
            {{ displayRows.length }} 件
          </span>
        </div>

        <!-- 列ヘッダで設定されたフィルタは上部バーから見えないので、ここでチップ表示。
             デフォルト非表示の列にフィルタが残っていても気付けるようにする。 -->
        <div
          v-if="hasActiveDateFilter"
          class="flex flex-wrap items-center gap-2 px-4 pb-2 border-b border-default"
        >
          <span class="text-xs text-muted">フィルタ:</span>
          <div
            v-for="chip in dateFilterChips"
            :key="chip.label"
            class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-primary/10 text-primary text-xs"
          >
            <span>{{ chip.label }}: {{ chip.text }}</span>
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="primary"
              variant="ghost"
              :aria-label="`${chip.label}フィルタをクリア`"
              @click="chip.clear"
            />
          </div>
        </div>

        <UTable
          ref="tableRef"
          v-model:sorting="sorting"
          v-model:column-sizing="columnSizing"
          v-model:column-sizing-info="columnSizingInfo"
          v-model:column-visibility="columnVisibility"
          v-model:column-order="columnOrder"
          :data="displayRows"
          :columns="columns"
          :column-sizing-options="{ enableColumnResizing: true, columnResizeMode: 'onChange' }"
          :ui="{
            base: 'table-fixed',
            th: 'relative group px-1',
            td: 'align-top py-2 px-1 truncate',
          }"
        >
          <template #seq-cell="{ row }">
            <div v-if="!isSubRow(row.original)" class="flex items-center gap-1.5">
              <UCheckbox
                v-if="!isReadonly"
                :model-value="isTaskSelected(row.original.id)"
                :aria-label="`#${row.original.seq} を選択`"
                @update:model-value="
                  (v: boolean | 'indeterminate') => toggleTaskSelected(row.original.id, v === true)
                "
              />
              <button
                class="font-mono text-xs text-muted hover:text-default"
                @click="openTask(row.original)"
              >
                #{{ row.original.seq }}
              </button>
            </div>
            <span v-else />
          </template>

          <template #content-cell="{ row }">
            <div v-if="isSubRow(row.original)" class="flex items-center gap-1.5 min-w-0">
              <USwitch
                :model-value="subOf(row.original)!.done"
                :aria-label="`${subOf(row.original)!.title} を完了`"
                size="sm"
                class="shrink-0"
                :disabled="isReadonly"
                @update:model-value="(v: boolean) => toggleSubtaskDone(subOf(row.original)!, v)"
              />
              <button
                class="min-w-0 truncate text-left hover:underline"
                :title="subOf(row.original)!.title"
                @click="openParentOfSub(subOf(row.original)!)"
              >
                <span class="text-muted">
                  #{{ subOf(row.original)!.parentSeq }} {{ subOf(row.original)!.parentContent }} ›
                </span>
                <span :class="subOf(row.original)!.done ? 'text-muted line-through' : ''">
                  {{ subOf(row.original)!.title }}
                </span>
              </button>
            </div>
            <div v-else class="flex items-center gap-1 min-w-0">
              <button
                class="text-left hover:underline truncate min-w-0"
                :title="row.original.content"
                @click="openTask(row.original)"
              >
                {{ row.original.content }}
              </button>
              <UBadge
                v-if="subtaskProgress.get(row.original.id)"
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-list-todo"
                class="shrink-0 gap-0.5 tabular-nums"
                :label="`${subtaskProgress.get(row.original.id)!.done}/${subtaskProgress.get(row.original.id)!.total}`"
                :title="`サブタスク ${subtaskProgress.get(row.original.id)!.done}/${subtaskProgress.get(row.original.id)!.total} 完了`"
              />
              <UButton
                v-if="row.original.commentCount > 0"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-message-square"
                :label="String(row.original.commentCount)"
                :aria-label="`コメント ${row.original.commentCount} 件を表示`"
                :title="`コメント ${row.original.commentCount} 件`"
                class="shrink-0 gap-0.5 px-1 text-muted"
                @click.stop="openTaskComments(row.original)"
              />
            </div>
          </template>

          <template #assigneeMemberId-cell="{ row }">
            <SelectMenu
              v-if="isSubRow(row.original)"
              :disabled="isReadonly"
              :items="memberSelectItems"
              :current="subOf(row.original)!.assigneeMemberId"
              :self-value="currentMemberId"
              allow-none
              none-label="担当者なし"
              default-icon="i-lucide-user"
              searchable
              search-placeholder="名前で検索…"
              @select="
                (c: string | null) =>
                  updateSubtaskField(subOf(row.original)!, { assigneeMemberId: c })
              "
            >
              <button class="text-sm text-muted hover:underline cursor-pointer">
                {{
                  memberMap[subOf(row.original)!.assigneeMemberId ?? '']?.displayName ??
                  '担当者なし'
                }}
              </button>
            </SelectMenu>
            <SelectMenu
              v-else
              :disabled="isReadonly"
              :items="memberSelectItems"
              :current="row.original.assigneeMemberId"
              :self-value="currentMemberId"
              allow-none
              none-label="担当者なし"
              default-icon="i-lucide-user"
              searchable
              search-placeholder="名前で検索…"
              @select="
                (c: string | null) => updateTaskField(row.original.id, { assigneeMemberId: c })
              "
            >
              <button class="text-sm hover:underline cursor-pointer">
                {{ memberMap[row.original.assigneeMemberId ?? '']?.displayName ?? '担当者なし' }}
              </button>
            </SelectMenu>
          </template>

          <template #statusCode-cell="{ row }">
            <span v-if="isSubRow(row.original)" />
            <SelectMenu
              v-else-if="statusMap[row.original.statusCode]"
              :disabled="isReadonly"
              :items="statusSelectItems"
              :current="row.original.statusCode"
              default-icon="i-lucide-circle-dashed"
              @select="
                (c: string | null) => c && updateTaskField(row.original.id, { statusCode: c })
              "
            >
              <UBadge
                :color="statusMap[row.original.statusCode]!.color"
                variant="subtle"
                :label="statusMap[row.original.statusCode]!.label"
                class="cursor-pointer hover:opacity-80"
              />
            </SelectMenu>
          </template>

          <template #priorityCode-cell="{ row }">
            <span v-if="isSubRow(row.original)" />
            <SelectMenu
              v-else
              :disabled="isReadonly"
              :items="prioritySelectItems"
              :current="row.original.priorityCode"
              allow-none
              default-icon="i-lucide-flag"
              @select="(c: string | null) => updateTaskField(row.original.id, { priorityCode: c })"
            >
              <UBadge
                v-if="row.original.priorityCode && priorityMap[row.original.priorityCode]"
                :color="priorityMap[row.original.priorityCode]!.color"
                variant="subtle"
                :label="priorityMap[row.original.priorityCode]!.label"
                class="cursor-pointer hover:opacity-80"
              />
              <UBadge
                v-else
                color="neutral"
                variant="outline"
                label="—"
                class="cursor-pointer hover:opacity-80"
              />
            </SelectMenu>
          </template>

          <template #tagCodes-cell="{ row }">
            <span v-if="isSubRow(row.original)" />
            <TagPicker
              v-else
              :disabled="isReadonly"
              :tags="tags"
              :selected="row.original.tagCodes"
              @update:selected="
                (codes: string[]) => updateTaskField(row.original.id, { tagCodes: codes })
              "
            >
              <button class="flex flex-wrap gap-1 cursor-pointer min-w-12">
                <UBadge
                  v-for="code in row.original.tagCodes"
                  :key="code"
                  :color="tagMap[code]?.color ?? 'neutral'"
                  variant="soft"
                  size="sm"
                  :label="tagMap[code]?.name ?? code"
                />
                <UBadge
                  v-if="row.original.tagCodes.length === 0"
                  color="neutral"
                  variant="outline"
                  label="+ タグ"
                  size="sm"
                />
              </button>
            </TagPicker>
          </template>

          <template #flagCodes-cell="{ row }">
            <TagPicker
              v-if="isSubRow(row.original)"
              :disabled="isReadonly"
              :tags="flags"
              :selected="subOf(row.original)!.flagCodes"
              @update:selected="
                (codes: string[]) => updateSubtaskField(subOf(row.original)!, { flagCodes: codes })
              "
            >
              <button class="flex flex-wrap gap-1 cursor-pointer min-w-12">
                <UBadge
                  v-for="code in subOf(row.original)!.flagCodes"
                  :key="code"
                  :color="flagMap[code]?.color ?? 'neutral'"
                  variant="soft"
                  size="sm"
                  :label="flagMap[code]?.name ?? code"
                />
                <UBadge
                  v-if="subOf(row.original)!.flagCodes.length === 0"
                  color="neutral"
                  variant="outline"
                  label="+ フラグ"
                  size="sm"
                />
              </button>
            </TagPicker>
            <TagPicker
              v-else
              :disabled="isReadonly"
              :tags="flags"
              :selected="row.original.flagCodes"
              @update:selected="
                (codes: string[]) => updateTaskField(row.original.id, { flagCodes: codes })
              "
            >
              <button class="flex flex-wrap gap-1 cursor-pointer min-w-12">
                <UBadge
                  v-for="code in row.original.flagCodes"
                  :key="code"
                  :color="flagMap[code]?.color ?? 'neutral'"
                  variant="soft"
                  size="sm"
                  :label="flagMap[code]?.name ?? code"
                />
                <UBadge
                  v-if="row.original.flagCodes.length === 0"
                  color="neutral"
                  variant="outline"
                  label="+ フラグ"
                  size="sm"
                />
              </button>
            </TagPicker>
          </template>

          <template #deadline-cell="{ row }">
            <DatePopover
              v-if="isSubRow(row.original)"
              :disabled="isReadonly"
              :model-value="subOf(row.original)!.deadline"
              @update:model-value="
                (v: string | null) => updateSubtaskField(subOf(row.original)!, { deadline: v })
              "
            >
              <button
                class="text-sm tabular-nums hover:underline cursor-pointer min-w-16 text-left inline-flex items-center gap-1"
                :class="subOverdue(subOf(row.original)!) ? 'text-error font-medium' : 'text-muted'"
              >
                {{ subOf(row.original)!.deadline ?? '—' }}
                <UIcon
                  v-if="subOverParent(subOf(row.original)!)"
                  name="i-lucide-triangle-alert"
                  class="size-3.5 text-warning"
                  title="親タスクの期限を超えています"
                />
              </button>
            </DatePopover>
            <DatePopover
              v-else
              :disabled="isReadonly"
              :model-value="row.original.deadline"
              @update:model-value="
                (v: string | null) => updateTaskField(row.original.id, { deadline: v })
              "
            >
              <button
                class="text-sm tabular-nums hover:underline cursor-pointer min-w-16 text-left"
                :class="isOverdue(row.original) ? 'text-error font-medium' : ''"
              >
                {{ row.original.deadline ?? '—' }}
              </button>
            </DatePopover>
          </template>

          <template #plannedStartDate-cell="{ row }">
            <span v-if="isSubRow(row.original)" />
            <DatePopover
              v-else
              :disabled="isReadonly"
              :model-value="row.original.plannedStartDate"
              @update:model-value="
                (v: string | null) => updateTaskField(row.original.id, { plannedStartDate: v })
              "
            >
              <button
                class="text-sm tabular-nums hover:underline cursor-pointer min-w-16 text-left"
                :class="isPlannedStartOverdue(row.original) ? 'text-error font-medium' : ''"
              >
                {{ row.original.plannedStartDate ?? '—' }}
              </button>
            </DatePopover>
          </template>

          <template #plannedCompletionDate-cell="{ row }">
            <span v-if="isSubRow(row.original)" />
            <DatePopover
              v-else
              :disabled="isReadonly"
              :model-value="row.original.plannedCompletionDate"
              @update:model-value="
                (v: string | null) => updateTaskField(row.original.id, { plannedCompletionDate: v })
              "
            >
              <button
                class="text-sm tabular-nums hover:underline cursor-pointer min-w-16 text-left"
                :class="isPlannedCompletionOverdue(row.original) ? 'text-error font-medium' : ''"
              >
                {{ row.original.plannedCompletionDate ?? '—' }}
              </button>
            </DatePopover>
          </template>

          <template #plannedReleaseDate-cell="{ row }">
            <span v-if="isSubRow(row.original)" />
            <DatePopover
              v-else
              :disabled="isReadonly"
              :model-value="row.original.plannedReleaseDate"
              @update:model-value="
                (v: string | null) => updateTaskField(row.original.id, { plannedReleaseDate: v })
              "
            >
              <button
                class="text-sm tabular-nums hover:underline cursor-pointer min-w-16 text-left"
                :class="isPlannedReleaseOverdue(row.original) ? 'text-error font-medium' : ''"
              >
                {{ row.original.plannedReleaseDate ?? '—' }}
              </button>
            </DatePopover>
          </template>

          <template #requesterMemberId-cell="{ row }">
            <span class="text-sm">
              {{
                isSubRow(row.original)
                  ? ''
                  : (memberMap[row.original.requesterMemberId ?? '']?.displayName ?? '—')
              }}
            </span>
          </template>

          <template #requestingDeptCode-cell="{ row }">
            <span class="text-sm">
              {{
                isSubRow(row.original)
                  ? ''
                  : (departmentMap[row.original.requestingDeptCode ?? '']?.name ?? '—')
              }}
            </span>
          </template>

          <template #description-cell="{ row }">
            <span class="text-xs text-muted block truncate" :title="row.original.description">
              {{ isSubRow(row.original) ? '' : row.original.description || '—' }}
            </span>
          </template>

          <template #links-cell="{ row }">
            <span v-if="isSubRow(row.original)" />
            <div v-else class="flex flex-wrap gap-1">
              <a
                v-for="(link, i) in row.original.links"
                :key="i"
                :href="link.url"
                target="_blank"
                rel="noopener"
                class="text-xs text-primary hover:underline"
                :title="link.url"
                @click.stop
              >
                {{ link.label || 'link' }}
              </a>
              <span v-if="row.original.links.length === 0" class="text-xs text-muted"> — </span>
            </div>
          </template>

          <template #completedAt-cell="{ row }">
            <span class="text-xs text-muted tabular-nums">
              {{
                isSubRow(row.original)
                  ? ''
                  : row.original.completedAt
                    ? fmtDateTime(row.original.completedAt)
                    : '—'
              }}
            </span>
          </template>

          <template #statusChangedAt-cell="{ row }">
            <span class="text-xs text-muted tabular-nums">
              {{ isSubRow(row.original) ? '' : fmtDateTime(row.original.statusChangedAt) }}
            </span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-xs text-muted tabular-nums">
              {{ isSubRow(row.original) ? '' : fmtDateTime(row.original.createdAt) }}
            </span>
          </template>

          <template #updatedAt-cell="{ row }">
            <span class="text-xs text-muted tabular-nums">
              {{ isSubRow(row.original) ? '' : fmtDateTime(row.original.updatedAt) }}
            </span>
          </template>

          <template #empty>
            <div class="flex flex-col items-center gap-2 py-10 text-muted">
              <UIcon name="i-lucide-search-x" class="size-8" />
              <p class="text-sm">条件に合うタスクがありません</p>
              <UButton
                v-if="hasActiveFilter"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                label="フィルタをクリア"
                @click="resetFilters"
              />
            </div>
          </template>
        </UTable>

        <!-- 一括編集のアクションバー（行を選択中だけ表示） -->
        <div
          v-if="selectedCount > 0"
          class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-default bg-default/95 shadow-lg px-4 py-2 backdrop-blur"
        >
          <span class="text-sm font-medium">{{ selectedCount }} 件選択中</span>
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-pencil"
            label="一括編集"
            @click="bulkEditOpen = true"
          />
          <UButton color="neutral" variant="ghost" size="sm" label="解除" @click="clearSelection" />
        </div>

        <!-- 列リサイズ中、掴んだ位置を列全体に貫くガイド線 -->
        <div
          v-if="resizeGuide"
          class="fixed z-50 w-px bg-primary pointer-events-none"
          :style="{
            left: `${resizeGuide.x}px`,
            top: `${resizeGuide.top}px`,
            height: `${resizeGuide.height}px`,
          }"
        />
      </template>
    </template>
  </UDashboardPanel>

  <TaskDetailSlideover
    :open="slideoverOpen"
    :task="selectedTask"
    :tasks="tasks"
    :current-member-id="currentMemberId"
    :status-map="statusMap"
    :priority-map="priorityMap"
    :member-map="memberMap"
    :tag-map="tagMap"
    :flag-map="flagMap"
    :department-map="departmentMap"
    :focus-comments="focusComments"
    @focused="focusComments = false"
    @update:open="(v: boolean) => !v && closeSlideover()"
    @change-field="
      (patch: Partial<Task>) => selectedTask && updateTaskField(selectedTask.id, patch)
    "
    @subtasks-changed="refreshSubtasks"
  />

  <TaskCreateSlideover
    v-model:open="createSlideoverOpen"
    :project-id="currentProjectId"
    :current-member-id="currentMemberId"
    :statuses="statuses"
    :priorities="priorities"
    :tags="tags"
    :flags="flags"
    :members="members"
    :departments="departments"
    @created="onTaskCreated"
  />

  <FlagOpsDialog
    v-model:open="flagOpsOpen"
    :project-id="currentProjectId"
    :flags="flags"
    @done="refreshTasks"
  />

  <BulkEditDialog
    v-model:open="bulkEditOpen"
    :count="selectedCount"
    :statuses="statuses"
    :priorities="priorities"
    :members="members"
    :tags="tags"
    :flags="flags"
    :applying="bulkApplying"
    @apply="applyBulkEdit"
  />
</template>
