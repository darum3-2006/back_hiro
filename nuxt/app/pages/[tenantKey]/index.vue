<script setup lang="ts">
import dayjs from 'dayjs';
import type { MyTask } from '~/types/task';

// ホーム = 自分の担当タスク（テナント横断）のダッシュボード。
const { data: myTasks } = await useMyTasks();
const { data: projects } = await useProjects();
const { me } = useAuth();

const today = dayjs().startOf('day');

// 期限間近とみなす日数（1〜30、既定 7）。カード右上のプルダウンで変更し、選択は localStorage に永続化。
const SOON_DAYS_KEY = 'home:due-soon-days';
const soonDays = ref(7);
const soonDayOptions = Array.from({ length: 30 }, (_, i) => ({
  label: `${i + 1}日`,
  value: i + 1,
}));
const soonEnd = computed(() => today.add(soonDays.value, 'day').endOf('day'));
onMounted(() => {
  const saved = Number(localStorage.getItem(SOON_DAYS_KEY));
  if (Number.isInteger(saved) && saved >= 1 && saved <= 30) soonDays.value = saved;
});
watch(soonDays, (v) => localStorage.setItem(SOON_DAYS_KEY, String(v)));

// 期限超過を赤字にするかはプロジェクトごとの設定（highlightOverdueDeadline）に従う。
// /me/tasks は非終端ステータスのみ返すので、ここでは期限が過去かだけ見れば良い。
const highlightMap = computed(
  () => new Map(projects.value.map((p) => [p.id, p.highlightOverdueDeadline])),
);
const isOverdue = (t: MyTask): boolean =>
  !!t.deadline &&
  (highlightMap.value.get(t.projectId) ?? false) &&
  dayjs(t.deadline).isBefore(today);

// 期限切れ: 期限が今日より前
const overdue = computed(() =>
  myTasks.value.filter((t) => t.deadline && dayjs(t.deadline).isBefore(today)),
);
// 期限間近: 今日〜soonDays 日以内
const dueSoon = computed(() =>
  myTasks.value.filter(
    (t) =>
      t.deadline && !dayjs(t.deadline).isBefore(today) && !dayjs(t.deadline).isAfter(soonEnd.value),
  ),
);

// 担当（未完了）全件をプロジェクト別にグルーピング
const byProject = computed(() => {
  const map = new Map<string, { projectId: string; projectName: string; tasks: MyTask[] }>();
  for (const t of myTasks.value) {
    const g = map.get(t.projectId) ?? {
      projectId: t.projectId,
      projectName: t.projectName,
      tasks: [],
    };
    g.tasks.push(t);
    map.set(t.projectId, g);
  }
  return [...map.values()].sort((a, b) => a.projectName.localeCompare(b.projectName, 'ja'));
});
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="ホーム" icon="i-lucide-house">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <p class="text-sm text-muted">{{ me?.name }} さんの担当タスク</p>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 font-medium">
                <UIcon name="i-lucide-alarm-clock" class="size-4 text-warning" />
                期限切れ・期限間近
              </div>
              <div class="flex items-center gap-1.5 text-xs text-muted">
                <span>期限間近</span>
                <USelect v-model="soonDays" :items="soonDayOptions" size="xs" class="w-20" />
                <span>以内</span>
              </div>
            </div>
          </template>

          <div v-if="overdue.length === 0 && dueSoon.length === 0" class="py-2 text-sm text-muted">
            期限が迫っているタスクはありません 🎉
          </div>
          <div v-else class="space-y-4">
            <!-- 片方が 0 でも両方の見出しを出す（例: 期限切れあり・期限間近なし → 期限間近（0）） -->
            <div>
              <p class="mb-1 text-xs font-medium text-error">期限切れ（{{ overdue.length }}）</p>
              <MyTaskRow
                v-for="t in overdue"
                :key="t.shortCode"
                :task="t"
                :overdue="isOverdue(t)"
              />
            </div>
            <div>
              <p class="mb-1 text-xs font-medium text-warning">期限間近（{{ dueSoon.length }}）</p>
              <MyTaskRow v-for="t in dueSoon" :key="t.shortCode" :task="t" />
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center gap-2 font-medium">
              <UIcon name="i-lucide-list-checks" class="size-4 text-primary" />
              担当タスク（未完了）
              <UBadge color="neutral" variant="soft" size="sm" :label="String(myTasks.length)" />
            </div>
          </template>

          <EmptyState
            v-if="myTasks.length === 0"
            icon="i-lucide-check-check"
            title="担当の未完了タスクはありません"
            description="新しく割り当てられるとここに表示されます"
          />
          <div v-else class="space-y-4">
            <div v-for="g in byProject" :key="g.projectId">
              <p class="mb-1 text-xs font-medium text-muted">
                {{ g.projectName }}（{{ g.tasks.length }}）
              </p>
              <MyTaskRow
                v-for="t in g.tasks"
                :key="t.shortCode"
                :task="t"
                :overdue="isOverdue(t)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
