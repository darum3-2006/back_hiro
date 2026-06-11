<script setup lang="ts">
import { h, resolveComponent } from 'vue';
import type { ColumnSizingInfoState, Row } from '@tanstack/vue-table';
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui';
import { VueDraggable } from 'vue-draggable-plus';
import { apiUpdateTask } from '~/api/tasks';
import type { DateRangeValue } from '~/components/DateRangeFilter.vue';
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

const { data: tasks, refresh: refreshTasks } = await useTasks(currentProjectId);
const { data: statuses } = await useTaskStatuses(currentProjectId);
const { data: priorities } = await useTaskPriorities(currentProjectId);
const { data: tags } = await useTags(currentProjectId);
const { data: members } = await useMembers(currentProjectId);
const { data: departments } = await useDepartments();
const { data: projects } = await useProjects();
const currentProject = computed(() => projects.value.find((p) => p.id === currentProjectId.value));

const currentMemberId = computed<string | null>(() => {
  const userId = currentUserId.value;
  if (!userId) return null;
  return members.value.find((m) => m.userId === userId)?.id ?? null;
});

const statusMap = computed(() => Object.fromEntries(statuses.value.map((s) => [s.code, s])));
const priorityMap = computed(() => Object.fromEntries(priorities.value.map((p) => [p.code, p])));
const tagMap = computed(() => Object.fromEntries(tags.value.map((t) => [t.code, t])));
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

const appliedStatusFilter = ref<string[]>([...statusFilter.value]);
const appliedPriorityFilter = ref<string[]>([...priorityFilter.value]);
const appliedAssigneeFilter = ref<string[]>([...assigneeFilter.value]);
const appliedTagFilter = ref<string[]>([...tagFilter.value]);

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
};

watch([statusFilter, priorityFilter, assigneeFilter, tagFilter], () => scheduleApply(), {
  deep: true,
});

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
                : appliedTagFilter;
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
const plannedCompletionFilter = useDateRangeFilter('plannedCompletionFrom', 'plannedCompletionTo');
const plannedReleaseFilter = useDateRangeFilter('plannedReleaseFrom', 'plannedReleaseTo');
const completedAtFilter = useDateRangeFilter('completedAtFrom', 'completedAtTo');

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
    { label: '完了予定日', filter: plannedCompletionFilter },
    { label: 'リリース予定日', filter: plannedReleaseFilter },
    { label: '完了日時', filter: completedAtFilter },
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
const memberSelectItems = computed(() =>
  members.value.map((m) => ({ label: m.displayName, value: m.id })),
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
    showCompleted: undefined,
    deadlineFrom: undefined,
    deadlineTo: undefined,
    plannedCompletionFrom: undefined,
    plannedCompletionTo: undefined,
    plannedReleaseFrom: undefined,
    plannedReleaseTo: undefined,
    completedAtFrom: undefined,
    completedAtTo: undefined,
  });
};

// ===== タスク詳細スライドオーバー: URL クエリで連動 =====
// URL にはタスクの連番(seq, 表示用 #N)を載せる。詳細ページは projectId スコープなので
// seq はプロジェクト内一意で曖昧にならない。内部処理は解決した Task の id を使う。
// 旧 URL は UUID を載せていたので、後方互換で id 解決も受け付ける（解決後 seq に正規化）。
const taskParam = computed<string | null>(() => queryString('task') || null);

const selectedTask = computed<Task | null>(() => {
  const raw = taskParam.value;
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) {
    return tasks.value.find((t) => t.seq === n) ?? null;
  }
  // 後方互換: 旧 URL の UUID
  return tasks.value.find((t) => t.id === raw) ?? null;
});

// 該当タスクが解決できたときだけ開く（未存在の番号で空パネルを出さない）。
const slideoverOpen = computed(() => selectedTask.value !== null);

const setSelectedTaskSeq = (seq: number | null) => {
  updateQuery({ task: seq === null ? undefined : String(seq) });
};

const openTask = (task: Task) => {
  setSelectedTaskSeq(task.seq);
};

const closeSlideover = () => {
  setSelectedTaskSeq(null);
};

const createSlideoverOpen = ref(false);
const toast = useToast();

// URL の task パラメータを検証・正規化する。
// - 見つからない番号/ID → 通知して一覧へ戻す（空パネルを出さない）
// - UUID 等 seq 以外で解決できた場合 → URL を seq へ正規化
const normalizeTaskParam = () => {
  const raw = taskParam.value;
  if (raw === null) return;
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
watch([taskParam, selectedTask], normalizeTaskParam);
onMounted(normalizeTaskParam);

const onTaskCreated = async (task: Task) => {
  await refreshTasks();
  toast.add({
    title: 'タスクを作成しました',
    description: `#${task.seq} ${task.content}`,
    color: 'success',
    icon: 'i-lucide-check',
  });
};

const filteredTasks = computed(() => {
  // チェック直後のチラつき防止のため、applied 系 (rAF で 1 フレーム遅延) を使う
  const statusSet = new Set(appliedStatusFilter.value);
  const prioritySet = new Set(appliedPriorityFilter.value);
  const assigneeSet = new Set(appliedAssigneeFilter.value);
  const tagSet = new Set(appliedTagFilter.value);

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
      const matched =
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
    // 日付範囲フィルタ。null 値は範囲指定中は除外。
    if (!matchesDateRange(t.deadline, deadlineFilter.range.value)) return false;
    if (!matchesDateRange(t.plannedCompletionDate, plannedCompletionFilter.range.value)) {
      return false;
    }
    if (!matchesDateRange(t.plannedReleaseDate, plannedReleaseFilter.range.value)) return false;
    if (!matchesDateRange(t.completedAt, completedAtFilter.range.value)) return false;
    return true;
  });
});

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
    accessorKey: 'createdAt',
    header: sortHeader('作成日時'),
    size: 140,
    minSize: 100,
    meta: RESIZABLE_META,
  },
  {
    accessorKey: 'updatedAt',
    header: sortHeader('更新日時'),
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
  deadline: '期限',
  plannedCompletionDate: '完了予定日',
  plannedReleaseDate: 'リリース予定日',
  requesterMemberId: '起票者',
  requestingDeptCode: '依頼部署',
  description: '説明',
  links: 'リンク',
  completedAt: '完了日時',
  createdAt: '作成日時',
  updatedAt: '更新日時',
};

/** デフォルトで非表示にする列（ユーザーが切り替えれば永続化） */
const DEFAULT_HIDDEN_COLUMNS: Record<string, boolean> = {
  plannedCompletionDate: false,
  plannedReleaseDate: false,
  requesterMemberId: false,
  requestingDeptCode: false,
  description: false,
  links: false,
  completedAt: false,
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

const updateTaskField = async (
  taskId: string,
  patch: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt' | 'seq'>>,
) => {
  await apiUpdateTask(api, currentProjectId.value, taskId, patch);
  await refreshTasks();
};

const isOverdue = (task: Task): boolean =>
  (currentProject.value?.highlightOverdueDeadline ?? false) &&
  isTaskDatePast(task.deadline, task.statusCode, statusMap.value);

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
          <span class="ml-auto text-sm text-muted">
            {{ filteredTasks.length }} / {{ tasks.length }} 件
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
          :data="filteredTasks"
          :columns="columns"
          :column-sizing-options="{ enableColumnResizing: true, columnResizeMode: 'onChange' }"
          :ui="{
            base: 'table-fixed',
            th: 'relative group px-1',
            td: 'align-top py-2 px-1 truncate',
          }"
        >
          <template #seq-cell="{ row }">
            <button
              class="font-mono text-xs text-muted hover:text-default"
              @click="openTask(row.original)"
            >
              #{{ row.original.seq }}
            </button>
          </template>

          <template #content-cell="{ row }">
            <button
              class="text-left hover:underline block w-full truncate"
              :title="row.original.content"
              @click="openTask(row.original)"
            >
              {{ row.original.content }}
            </button>
          </template>

          <template #assigneeMemberId-cell="{ row }">
            <SelectMenu
              :items="memberSelectItems"
              :current="row.original.assigneeMemberId"
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
            <SelectMenu
              v-if="statusMap[row.original.statusCode]"
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
            <SelectMenu
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
            <TagPicker
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

          <template #deadline-cell="{ row }">
            <DatePopover
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

          <template #plannedCompletionDate-cell="{ row }">
            <DatePopover
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
            <DatePopover
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
              {{ memberMap[row.original.requesterMemberId ?? '']?.displayName ?? '—' }}
            </span>
          </template>

          <template #requestingDeptCode-cell="{ row }">
            <span class="text-sm">
              {{ departmentMap[row.original.requestingDeptCode ?? '']?.name ?? '—' }}
            </span>
          </template>

          <template #description-cell="{ row }">
            <span class="text-xs text-muted block truncate" :title="row.original.description">
              {{ row.original.description || '—' }}
            </span>
          </template>

          <template #links-cell="{ row }">
            <div class="flex flex-wrap gap-1">
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
              {{ row.original.completedAt ? fmtDateTime(row.original.completedAt) : '—' }}
            </span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-xs text-muted tabular-nums">
              {{ fmtDateTime(row.original.createdAt) }}
            </span>
          </template>

          <template #updatedAt-cell="{ row }">
            <span class="text-xs text-muted tabular-nums">
              {{ fmtDateTime(row.original.updatedAt) }}
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
    :department-map="departmentMap"
    @update:open="(v: boolean) => !v && closeSlideover()"
    @change-field="
      (patch: Partial<Task>) => selectedTask && updateTaskField(selectedTask.id, patch)
    "
  />

  <TaskCreateSlideover
    v-model:open="createSlideoverOpen"
    :project-id="currentProjectId"
    :current-member-id="currentMemberId"
    :statuses="statuses"
    :priorities="priorities"
    :tags="tags"
    :members="members"
    :departments="departments"
    @created="onTaskCreated"
  />
</template>
