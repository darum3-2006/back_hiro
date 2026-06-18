<script setup lang="ts">
import dayjs from 'dayjs';
import type { Task } from '~/types/task';
import {
  GANTT_GROUP_DEFS,
  GANTT_ROW_SORTS,
  type Granularity,
  type GroupByKey,
  type RowSortKey,
} from '~/utils/gantt';

const route = useRoute();
const router = useRouter();
const currentProjectId = useCurrentProjectId();
const currentTenantKey = useCurrentTenantKey();

// 既定では完了タスクを取得しない（タスク一覧と同じ挙動）
const includeCompleted = computed(
  () => route.query.showCompleted === '1' || Boolean(route.query.status),
);

const { data: tasks } = await useTasks(currentProjectId, includeCompleted);
const { data: statuses } = await useTaskStatuses(currentProjectId);
const { data: priorities } = await useTaskPriorities(currentProjectId);
const { data: tags } = await useTags(currentProjectId);
const { data: flags } = await useFlags(currentProjectId);
const { data: members } = await useMembers(currentProjectId);
const { data: departments } = await useDepartments();

const filters = useTaskFilters({ tasks, statuses, priorities, members, tags, flags });
const { filteredTasks, statusMap } = filters;

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

// バー/ラベルのクリックで一覧の該当タスク詳細を開く（v1 は読取専用）
const openTask = (task: Task) => {
  navigateTo(
    `/${currentTenantKey.value}/projects/${currentProjectId.value}/tasks?task=${task.seq}`,
  );
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
        @select="openTask"
      />
    </template>
  </UDashboardPanel>
</template>
