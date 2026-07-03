<script setup lang="ts">
import dayjs from 'dayjs';
import { apiUpdateTask } from '~/api/tasks';
import type { Task } from '~/types/task';
import {
  GANTT_GROUP_DEFS,
  GANTT_ROW_SORTS,
  type Granularity,
  type GroupByKey,
  type RowSortKey,
} from '~/utils/gantt';

const api = useApi();
const route = useRoute();
const router = useRouter();
const currentProjectId = useCurrentProjectId();
const currentUserId = useCurrentUserId();

// 既定では完了タスクを取得しない（タスク一覧と同じ挙動）
const includeCompleted = computed(
  () => route.query.showCompleted === '1' || Boolean(route.query.status),
);

// フィルタを画面間で共有・記憶（await より前に登録する）
useTaskFilterMemory();

const { data: tasks, refresh: refreshTasks } = await useTasks(currentProjectId, includeCompleted);
const { data: statuses } = await useTaskStatuses(currentProjectId);
const { data: priorities } = await useTaskPriorities(currentProjectId);
const { data: tags } = await useTags(currentProjectId);
const { data: flags } = await useFlags(currentProjectId);
const { data: members } = await useMembers(currentProjectId);
const { data: departments } = await useDepartments();

const filters = useTaskFilters({ tasks, statuses, priorities, members, tags, flags });
const { filteredTasks, statusMap } = filters;

// 詳細スライドオーバー用のマップ（一覧と同じ）
const priorityMap = computed(() => Object.fromEntries(priorities.value.map((p) => [p.code, p])));
const memberMap = computed(() => Object.fromEntries(members.value.map((m) => [m.id, m])));
const tagMap = computed(() => Object.fromEntries(tags.value.map((t) => [t.code, t])));
const flagMap = computed(() => Object.fromEntries(flags.value.map((f) => [f.code, f])));
const departmentMap = computed(() => Object.fromEntries(departments.value.map((d) => [d.code, d])));

const currentMemberId = computed<string | null>(() => {
  const uid = currentUserId.value;
  if (!uid) return null;
  return members.value.find((m) => m.userId === uid)?.id ?? null;
});

// ===== ガント固有の表示状態（URL クエリ保持・将来 SavedView 化しやすい形） =====
const queryString = (key: string): string => (route.query[key] as string | undefined) ?? '';
const setQuery = (key: string, value: string | undefined) => {
  const merged = { ...route.query, [key]: value || undefined };
  const cleaned = Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined && v !== ''),
  );
  router.replace({ query: cleaned });
};

const GROUP_KEYS = Object.keys(GANTT_GROUP_DEFS) as GroupByKey[];
const SORT_KEYS = Object.keys(GANTT_ROW_SORTS) as RowSortKey[];
const GRANULARITIES: Granularity[] = ['day', 'week', 'month'];

const groupBy = computed<GroupByKey>({
  get: () => {
    const v = queryString('gGroup') as GroupByKey;
    return GROUP_KEYS.includes(v) ? v : 'none';
  },
  set: (v) => setQuery('gGroup', v === 'none' ? undefined : v),
});
const granularity = computed<Granularity>({
  get: () => {
    const v = queryString('gScale') as Granularity;
    return GRANULARITIES.includes(v) ? v : 'week';
  },
  set: (v) => setQuery('gScale', v === 'week' ? undefined : v),
});
const rowSort = computed<RowSortKey>({
  get: () => {
    const v = queryString('gSort') as RowSortKey;
    return SORT_KEYS.includes(v) ? v : 'plannedStart';
  },
  set: (v) => setQuery('gSort', v === 'plannedStart' ? undefined : v),
});

const groupByItems = GROUP_KEYS.map((value) => ({ label: GANTT_GROUP_DEFS[value].label, value }));
const rowSortItems = SORT_KEYS.map((value) => ({ label: GANTT_ROW_SORTS[value].label, value }));
const granularityItems = [
  { label: '日', value: 'day' },
  { label: '週', value: 'week' },
  { label: '月', value: 'month' },
];

// 表示期間（着手予定・完了予定・期限の最小〜最大。今日を含め前後に余白）。
// 予定日が無いタスクも行は出す（バーが空なだけ）ので、期限だけでも期間に含める。
const domainStart = computed(() => {
  const today = dayjs().format('YYYY-MM-DD');
  let min = today;
  for (const t of filteredTasks.value) {
    for (const d of [t.plannedStartDate, t.plannedCompletionDate, t.deadline]) {
      if (d && d < min) min = d;
    }
  }
  return dayjs(min).subtract(3, 'day').format('YYYY-MM-DD');
});
const domainEnd = computed(() => {
  const today = dayjs().format('YYYY-MM-DD');
  let max = today;
  for (const t of filteredTasks.value) {
    for (const d of [t.plannedStartDate, t.plannedCompletionDate, t.deadline]) {
      if (d && d > max) max = d;
    }
  }
  return dayjs(max).add(7, 'day').format('YYYY-MM-DD');
});

const scale = useGanttScale({ granularity, domainStart, domainEnd });

const ctx = computed(() => ({
  members: members.value,
  statuses: statuses.value,
  priorities: priorities.value,
  departments: departments.value,
  tags: tags.value,
}));

// 予定日未設定のタスクも含めて全件をグループ化（バーが空の行として並ぶ）
const groups = computed(() => {
  const built = GANTT_GROUP_DEFS[groupBy.value].build(filteredTasks.value, ctx.value);
  const compare = GANTT_ROW_SORTS[rowSort.value].compare;
  return built.map((g) => ({ ...g, tasks: [...g.tasks].sort(compare) }));
});

// ===== タスク詳細スライドオーバー: URL クエリ(?task=seq)で連動（一覧と同じ作法） =====
const taskParam = computed<string | null>(() => queryString('task') || null);

const taskFromList = computed<Task | null>(() => {
  const raw = taskParam.value;
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) {
    return tasks.value.find((t) => t.seq === n) ?? null;
  }
  return tasks.value.find((t) => t.id === raw) ?? null;
});

// 完了にして一覧から外れてもスライドを開いたままにするためのキャッシュ
const openTaskCache = ref<Task | null>(null);
watch(
  taskFromList,
  (t) => {
    if (t) openTaskCache.value = t;
  },
  { immediate: true },
);
watch(taskParam, (raw) => {
  if (!raw) openTaskCache.value = null;
});

const selectedTask = computed<Task | null>(() => {
  const raw = taskParam.value;
  if (!raw) return null;
  if (taskFromList.value) return taskFromList.value;
  const cached = openTaskCache.value;
  if (cached && (String(cached.seq) === raw || cached.id === raw)) return cached;
  return null;
});

const slideoverOpen = computed(() => selectedTask.value !== null);

// ===== 関連タスク（G2: 選択時ハイライト / G3: 依存違反の警告） =====
const { data: relations, refresh: refreshRelations } = await useProjectRelations(currentProjectId);
const tasksById = computed(() => new Map(tasks.value.map((t) => [t.id, t])));

// タスク id → 関連するタスク id 集合（両方向・全種別）
const relatedMap = computed(() => {
  const m = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    let s = m.get(a);
    if (!s) {
      s = new Set();
      m.set(a, s);
    }
    s.add(b);
  };
  for (const e of relations.value) {
    add(e.sourceTaskId, e.targetTaskId);
    add(e.targetTaskId, e.sourceTaskId);
  }
  return m;
});
// 選択中タスクに関連するバーをハイライトする対象
const focusedRelatedIds = computed<Set<string>>(() =>
  selectedTask.value ? (relatedMap.value.get(selectedTask.value.id) ?? new Set()) : new Set(),
);
// 依存違反: 先行/ブロック元の完了予定 > 後続/被ブロックの着手予定（後続側に警告）
const violatedIds = computed(() => {
  const set = new Set<string>();
  const byId = tasksById.value;
  for (const e of relations.value) {
    if (e.type === 'related') continue;
    const src = byId.get(e.sourceTaskId);
    const tgt = byId.get(e.targetTaskId);
    if (
      src?.plannedCompletionDate &&
      tgt?.plannedStartDate &&
      src.plannedCompletionDate > tgt.plannedStartDate
    ) {
      set.add(tgt.id);
    }
  }
  return set;
});

// バー/ラベルのクリックで詳細スライドをその場で開く（遷移しない）
const openTask = (task: Task) => {
  setQuery('task', String(task.seq));
};
const closeSlideover = () => {
  setQuery('task', undefined);
};

const updateTaskField = async (
  taskId: string,
  patch: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt' | 'seq'>>,
) => {
  const updated = await apiUpdateTask(api, currentProjectId.value, taskId, patch);
  if (openTaskCache.value?.id === updated.id) openTaskCache.value = updated;
  await refreshTasks();
};
</script>

<template>
  <UDashboardPanel id="gantt">
    <template #header>
      <UDashboardNavbar title="ガント" icon="i-lucide-chart-gantt">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-1">
            <span class="text-xs text-muted">グループ</span>
            <USelectMenu v-model="groupBy" :items="groupByItems" value-key="value" class="w-32" />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-muted">並び</span>
            <USelectMenu v-model="rowSort" :items="rowSortItems" value-key="value" class="w-32" />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-muted">粒度</span>
            <USelectMenu
              v-model="granularity"
              :items="granularityItems"
              value-key="value"
              class="w-24"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <TaskFilterBar :filters="filters" :total="tasks.length" :filtered="filteredTasks.length" />

      <EmptyState
        v-if="filteredTasks.length === 0"
        icon="i-lucide-chart-gantt"
        title="表示できるタスクがありません"
        description="フィルタ条件に一致するタスクがありません"
      />
      <GanttChart
        v-else
        :groups="groups"
        :scale="scale"
        :status-map="statusMap"
        :show-group-header="groupBy !== 'none'"
        :related-ids="focusedRelatedIds"
        :violated-ids="violatedIds"
        @select="openTask"
      />
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
    @update:open="(v: boolean) => !v && closeSlideover()"
    @change-field="
      (patch: Partial<Task>) => selectedTask && updateTaskField(selectedTask.id, patch)
    "
    @relations-changed="refreshRelations"
  />
</template>
