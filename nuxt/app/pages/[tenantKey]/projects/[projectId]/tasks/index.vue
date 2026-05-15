<script setup lang="ts">
import { h, resolveComponent } from 'vue';
import type { ColumnSizingInfoState, Row } from '@tanstack/vue-table';
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui';
import dayjs from 'dayjs';
import { apiUpdateTask } from '~/api/tasks';
import type { Task } from '~/types/task';
import { fmtDateTime } from '~/utils/date';

const api = useApi();

const UButton = resolveComponent('UButton');

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

const search = computed<string>({
  get: () => queryString('search'),
  set: (v) => updateQuery({ search: v || undefined }),
});

const statusFilter = computed<string>({
  get: () => queryString('status'),
  set: (v) => updateQuery({ status: v || undefined }),
});

const priorityFilter = computed<string>({
  get: () => queryString('priority'),
  set: (v) => updateQuery({ priority: v || undefined }),
});

const assigneeFilter = computed<string>({
  get: () => queryString('assignee'),
  set: (v) => updateQuery({ assignee: v || undefined }),
});

const tagFilter = computed<string>({
  get: () => queryString('tag'),
  set: (v) => updateQuery({ tag: v || undefined }),
});

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
    tasks.value
      .map((t) => t.assigneeMemberId)
      .filter((id): id is string => Boolean(id)),
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
  const current = assigneeFilter.value;
  if (current && !items.some((i) => i.value === current)) {
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

/** 完了系ステータスを表示するか（既定 false）。URL クエリで保持 */
const showCompleted = computed<boolean>({
  get: () => queryString('showCompleted') === '1',
  set: (v) => updateQuery({ showCompleted: v ? '1' : undefined }),
});

const hasActiveFilter = computed(() =>
  Boolean(
    search.value ||
      statusFilter.value ||
      priorityFilter.value ||
      assigneeFilter.value ||
      tagFilter.value ||
      showCompleted.value,
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
  });
};

// ===== タスク詳細スライドオーバー: URL クエリで連動 =====
const selectedTaskId = computed<string | null>(() => queryString('task') || null);

const selectedTask = computed<Task | null>(() =>
  selectedTaskId.value !== null
    ? (tasks.value.find((t) => t.id === selectedTaskId.value) ?? null)
    : null,
);

const slideoverOpen = computed(() => selectedTaskId.value !== null);

const setSelectedTaskId = (id: string | null) => {
  updateQuery({ task: id === null ? undefined : id });
};

const openTask = (task: Task) => {
  setSelectedTaskId(task.id);
};

const closeSlideover = () => {
  setSelectedTaskId(null);
};

const createSlideoverOpen = ref(false);
const toast = useToast();

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
  return tasks.value.filter((t) => {
    // ステータスフィルタが選択されていればそれを最優先（完了系も含めて表示）
    if (statusFilter.value) {
      if (t.statusCode !== statusFilter.value) return false;
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
    if (priorityFilter.value && t.priorityCode !== priorityFilter.value) return false;
    if (assigneeFilter.value) {
      if (assigneeFilter.value === NO_ASSIGNEE) {
        if (t.assigneeMemberId) return false;
      } else if (t.assigneeMemberId !== assigneeFilter.value) {
        return false;
      }
    }
    if (tagFilter.value && !t.tagCodes.includes(tagFilter.value)) return false;
    return true;
  });
});

const sorting = computed<{ id: string; desc: boolean }[]>({
  get: () => {
    const id = queryString('sort');
    if (!id) return [{ id: 'id', desc: false }];
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
  column: { getIsResizing: () => boolean };
}

/** th 全幅をカバーする wrapper。右端にリサイズハンドルを絶対配置 */
const wrapHeader = (children: unknown[], header: ResizeHeader) => {
  const isResizing = header.column.getIsResizing();
  return h('div', { class: 'relative flex items-center w-full pr-2' }, [
    ...(children as never[]),
    h('div', {
      class: [
        'absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none transition-colors',
        isResizing ? 'bg-primary' : 'bg-default hover:bg-primary/60',
      ].join(' '),
      onMousedown: (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        header.getResizeHandler()(e);
      },
      onTouchstart: header.getResizeHandler(),
    }),
  ]);
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
          class: '-mx-2.5 data-[state=open]:bg-elevated',
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
    wrapHeader([h('span', { class: 'text-sm' }, label)], header);
};

/** リサイズハンドル配置用 + 列幅を th/td の style に反映する meta */
const RESIZABLE_META = {
  class: { th: 'relative' },
  style: {
    th: (header: { column: { getSize: () => number } }) => {
      const w = header.column.getSize();
      return { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px` };
    },
    td: (cell: { column: { getSize: () => number } }) => {
      const w = cell.column.getSize();
      return { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px` };
    },
  },
} as const;

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
    header: sortHeader('期限'),
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
    header: sortHeader('完了予定日'),
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

// 列の表示/非表示もプロジェクトごとに localStorage 永続化
const columnVisibilityKey = computed(
  () => `tasks:column-visibility:${currentProjectId.value}`,
);
const columnVisibility = ref<Record<string, boolean>>({});

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
  requesterMemberId: '起票者',
  requestingDeptCode: '依頼部署',
  description: '説明',
  links: 'リンク',
  createdAt: '作成日時',
  updatedAt: '更新日時',
};

/** デフォルトで非表示にする列（ユーザーが切り替えれば永続化） */
const DEFAULT_HIDDEN_COLUMNS: Record<string, boolean> = {
  plannedCompletionDate: false,
  requesterMemberId: false,
  requestingDeptCode: false,
  description: false,
  links: false,
  createdAt: false,
  updatedAt: false,
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
  try {
    const raw = localStorage.getItem(columnSizingKey.value);
    if (raw) columnSizing.value = JSON.parse(raw) as Record<string, number>;
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem(columnVisibilityKey.value);
    if (raw) {
      columnVisibility.value = JSON.parse(raw) as Record<string, boolean>;
    } else {
      // 初回はデフォルト非表示の列を反映
      columnVisibility.value = { ...DEFAULT_HIDDEN_COLUMNS };
    }
  } catch {
    columnVisibility.value = { ...DEFAULT_HIDDEN_COLUMNS };
  }
});

watch(
  columnSizing,
  (v) => {
    if (!import.meta.client) return;
    localStorage.setItem(columnSizingKey.value, JSON.stringify(v));
  },
  { deep: true },
);

watch(
  columnVisibility,
  (v) => {
    if (!import.meta.client) return;
    localStorage.setItem(columnVisibilityKey.value, JSON.stringify(v));
  },
  { deep: true },
);

const updateTaskField = async (
  taskId: string,
  patch: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt' | 'seq'>>,
) => {
  await apiUpdateTask(api, currentProjectId.value, taskId, patch);
  await refreshTasks();
};

/** 期限超過判定: 今日より前 かつ 完了系ステータスでない */
const isOverdue = (task: Task): boolean => {
  if (!task.deadline) return false;
  if (statusMap.value[task.statusCode]?.isTerminal) return false;
  return dayjs(task.deadline).isBefore(dayjs(), 'day');
};
</script>

<template>
  <UDashboardPanel id="tasks">
    <template #header>
      <UDashboardNavbar title="タスク一覧" icon="i-lucide-list-checks">
        <template #right>
          <UDropdownMenu :items="columnVisibilityItems" :ui="{ content: 'min-w-40' }">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-columns-3"
              label="表示列"
              trailing-icon="i-lucide-chevron-down"
            />
          </UDropdownMenu>
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
          >
            <template v-if="search" #trailing>
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="link"
                aria-label="検索内容をクリア"
                @click="search = ''"
              />
            </template>
          </UInput>
          <div class="flex items-center gap-1">
            <USelect
              v-model="statusFilter"
              :items="statusSelectItems"
              value-key="value"
              placeholder="すべてのステータス"
              class="w-44"
            />
            <UButton
              v-if="statusFilter"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="ステータスフィルタをクリア"
              @click="statusFilter = ''"
            />
          </div>
          <div class="flex items-center gap-1">
            <USelect
              v-model="priorityFilter"
              :items="prioritySelectItems"
              value-key="value"
              placeholder="すべての優先度"
              class="w-40"
            />
            <UButton
              v-if="priorityFilter"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="優先度フィルタをクリア"
              @click="priorityFilter = ''"
            />
          </div>
          <div class="flex items-center gap-1">
            <USelectMenu
              v-model="assigneeFilter"
              :items="assigneeFilterItems"
              value-key="value"
              placeholder="すべての担当者"
              icon="i-lucide-user"
              searchable
              search-placeholder="名前で検索…"
              class="w-44"
            />
            <UButton
              v-if="assigneeFilter"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="担当者フィルタをクリア"
              @click="assigneeFilter = ''"
            />
          </div>
          <div class="flex items-center gap-1">
            <USelectMenu
              v-model="tagFilter"
              :items="tagFilterItems"
              value-key="value"
              placeholder="すべてのタグ"
              icon="i-lucide-tag"
              searchable
              search-placeholder="タグ名で検索…"
              class="w-44"
            />
            <UButton
              v-if="tagFilter"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="タグフィルタをクリア"
              @click="tagFilter = ''"
            />
          </div>
          <UCheckbox
            v-model="showCompleted"
            label="完了も表示"
            :disabled="!!statusFilter"
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

        <EmptyState
          v-if="filteredTasks.length === 0"
          icon="i-lucide-search-x"
          title="条件に合うタスクがありません"
          description="フィルタを変更してみてください"
        >
          <UButton
            v-if="hasActiveFilter"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            label="フィルタをクリア"
            @click="resetFilters"
          />
        </EmptyState>

        <UTable
          v-else
          v-model:sorting="sorting"
          v-model:column-sizing="columnSizing"
          v-model:column-sizing-info="columnSizingInfo"
          v-model:column-visibility="columnVisibility"
          :data="filteredTasks"
          :columns="columns"
          :column-sizing-options="{ enableColumnResizing: true, columnResizeMode: 'onChange' }"
          :ui="{
            base: 'table-fixed',
            th: 'relative group',
            td: 'align-top py-2 truncate',
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
                (v: string | null) =>
                  updateTaskField(row.original.id, { plannedCompletionDate: v })
              "
            >
              <button
                class="text-sm tabular-nums hover:underline cursor-pointer min-w-16 text-left"
              >
                {{ row.original.plannedCompletionDate ?? '—' }}
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
            <span
              class="text-xs text-muted block truncate"
              :title="row.original.description"
            >
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
              <span
                v-if="row.original.links.length === 0"
                class="text-xs text-muted"
              >
                —
              </span>
            </div>
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
        </UTable>
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
