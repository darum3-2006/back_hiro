<script setup lang="ts">
import { apiUpdateTask } from '~/api/tasks';
import type { Task } from '~/types/task';
import { isTaskDatePast } from '~/utils/task-overdue';

const api = useApi();
const route = useRoute();
const router = useRouter();
const currentProjectId = useCurrentProjectId();
const currentUserId = useCurrentUserId();
const toast = useToast();

// 既定では完了タスクを取得しない（タスク一覧と同じ挙動。完了列は出るが中身はこれに従う）
const includeCompleted = computed(
  () => route.query.showCompleted === '1' || Boolean(route.query.status),
);

// フィルタを画面間で共有・記憶（await より前に登録する）
useTaskFilterMemory();

const { data: tasks, refresh: refreshTasks } = await useTasks(currentProjectId, includeCompleted);
const { data: projectSubtasks, refresh: refreshSubtasks } =
  await useProjectSubtasks(currentProjectId);
const { data: statuses, refresh: refreshStatuses } = await useTaskStatuses(currentProjectId);
const { data: priorities, refresh: refreshPriorities } = await useTaskPriorities(currentProjectId);
const { data: tags, refresh: refreshTags } = await useTags(currentProjectId);
const { data: flags, refresh: refreshFlags } = await useFlags(currentProjectId);
const { data: members, refresh: refreshMembers } = await useMembers(currentProjectId);
const { data: departments } = await useDepartments();
const { data: projects } = await useProjects();

// 他ユーザーの変更（SSE）を受けて表示中のデータを自動反映する
useProjectEvents(currentProjectId, {
  'tasks.changed': () => {
    void refreshTasks();
    void refreshSubtasks();
  },
  'masters.changed': () => {
    void refreshStatuses();
    void refreshPriorities();
    void refreshTags();
    void refreshFlags();
  },
  'members.changed': () => void refreshMembers(),
});

const filters = useTaskFilters({ tasks, statuses, priorities, members, tags, flags });
const { filteredTasks, statusMap } = filters;

const priorityMap = computed(() => Object.fromEntries(priorities.value.map((p) => [p.code, p])));
const memberMap = computed(() => Object.fromEntries(members.value.map((m) => [m.id, m])));
const tagMap = computed(() => Object.fromEntries(tags.value.map((t) => [t.code, t])));
const flagMap = computed(() => Object.fromEntries(flags.value.map((f) => [f.code, f])));
const departmentMap = computed(() => Object.fromEntries(departments.value.map((d) => [d.code, d])));

// タスク id → サブタスク進捗（done/total）。カードのバッジ＋バー表示に使う
const subtaskProgress = computed<Record<string, { done: number; total: number }>>(() => {
  const m: Record<string, { done: number; total: number }> = {};
  for (const s of projectSubtasks.value) {
    const e = (m[s.taskId] ??= { done: 0, total: 0 });
    e.total += 1;
    if (s.done) e.done += 1;
  }
  return m;
});

const currentMemberId = computed<string | null>(() => {
  const uid = currentUserId.value;
  if (!uid) return null;
  return members.value.find((m) => m.userId === uid)?.id ?? null;
});

const currentProject = computed(() => projects.value.find((p) => p.id === currentProjectId.value));
const isOverdue = (task: Task): boolean =>
  (currentProject.value?.highlightOverdueDeadline ?? false) &&
  isTaskDatePast(task.deadline, task.statusCode, statusMap.value);

// ドラッグでステータス変更（カードは KanbanBoard 側で楽観移動済み）
const moveTask = async ({ task, toStatusCode }: { task: Task; toStatusCode: string }) => {
  if (task.statusCode === toStatusCode) return;
  try {
    await apiUpdateTask(api, currentProjectId.value, task.id, { statusCode: toStatusCode });
  } catch {
    toast.add({ title: 'ステータスの変更に失敗しました', color: 'error' });
  } finally {
    await refreshTasks();
  }
};

// ===== タスク詳細スライドオーバー: ?task=seq 連動（一覧/ガントと同じ作法） =====
const queryString = (key: string): string => (route.query[key] as string | undefined) ?? '';
const taskParam = computed<string | null>(() => queryString('task') || null);

const taskFromList = computed<Task | null>(() => {
  const raw = taskParam.value;
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return tasks.value.find((t) => t.seq === n) ?? null;
  return tasks.value.find((t) => t.id === raw) ?? null;
});

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

const openTask = (task: Task) => {
  void router.replace({ query: { ...route.query, task: String(task.seq) } });
};
const closeSlideover = () => {
  const q = { ...route.query };
  delete q.task;
  void router.replace({ query: q });
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
  <UDashboardPanel id="board">
    <template #header>
      <UDashboardNavbar title="ボード" icon="i-lucide-columns-3">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <TaskFilterBar :filters="filters" :total="tasks.length" :filtered="filteredTasks.length" />
      <div class="min-h-0 flex-1">
        <KanbanBoard
          class="h-full"
          :statuses="statuses"
          :tasks="filteredTasks"
          :member-map="memberMap"
          :tag-map="tagMap"
          :flag-map="flagMap"
          :is-overdue="isOverdue"
          :progress-map="subtaskProgress"
          @open="openTask"
          @move="moveTask"
        />
      </div>
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
    @subtasks-changed="refreshSubtasks"
  />
</template>
