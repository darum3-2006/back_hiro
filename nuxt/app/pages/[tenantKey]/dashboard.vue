<script setup lang="ts">
import dayjs from 'dayjs';
import type { DashboardTask } from '~/types/dashboard';
import { DASHBOARD_DATE_FIELD_LABELS, type DashboardSettings } from '~/types/user-settings';

// 期限系の状況をプロジェクト横断で見るダッシュボード。
// ホーム（/[tenantKey]）が「自分の担当タスク」なのに対し、こちらは
// 閲覧できる全タスクが対象でチーム全体の遅延を見る。
const { settings, update } = useMySettings();
const currentTenantKey = useCurrentTenantKey();

const dateField = computed(() => settings.value.dashboard.dateField);
const dueSoonDays = computed(() => settings.value.dashboard.dueSoonDays);
const { data: due, status } = useDueTasks({ dateField, dueSoonDays });

const settingsOpen = ref(false);
const saveSettings = async (patch: Partial<DashboardSettings>) => {
  await update({ dashboard: patch });
};

const dateFieldLabel = computed(() => DASHBOARD_DATE_FIELD_LABELS[dateField.value]);

/** 閉じているときに見せる件数。まず気づかせるための窓 */
const PREVIEW_COUNT = 5;
/** 開いたときの上限。これを超える分は絞り込み済みの一覧へ渡す */
const EXPANDED_COUNT = 20;

interface ProjectGroup {
  projectId: string;
  projectName: string;
  tasks: DashboardTask[];
}

/** プロジェクト別にまとめ、件数の多い順に並べる（長くなっても上から深刻な順） */
const groupByProject = (tasks: DashboardTask[]): ProjectGroup[] => {
  const map = new Map<string, ProjectGroup>();
  for (const t of tasks) {
    const g = map.get(t.projectId) ?? {
      projectId: t.projectId,
      projectName: t.projectName,
      tasks: [],
    };
    g.tasks.push(t);
    map.set(t.projectId, g);
  }
  return [...map.values()].sort(
    (a, b) => b.tasks.length - a.tasks.length || a.projectName.localeCompare(b.projectName, 'ja'),
  );
};

const overdueGroups = computed(() => groupByProject(due.value.overdue));
const dueSoonGroups = computed(() => groupByProject(due.value.dueSoon));

/** 基準日から何日過ぎたか。負なら残り日数 */
const daysPast = (t: DashboardTask): number =>
  dayjs().startOf('day').diff(dayjs(t.targetDate), 'day');

/**
 * 絞り込み済みタスク一覧へのリンク。
 * 基準日付ごとの from/to クエリキーはタスク一覧のフィルタと同じものを使う。
 */
const DATE_QUERY_KEYS = {
  deadline: ['deadlineFrom', 'deadlineTo'],
  plannedStart: ['plannedStartFrom', 'plannedStartTo'],
  plannedCompletion: ['plannedCompletionFrom', 'plannedCompletionTo'],
  plannedRelease: ['plannedReleaseFrom', 'plannedReleaseTo'],
} as const;

const listLink = (projectId: string, kind: 'overdue' | 'dueSoon'): string => {
  const [fromKey, toKey] = DATE_QUERY_KEYS[dateField.value];
  const today = dayjs().startOf('day');
  const query =
    kind === 'overdue'
      ? `${toKey}=${today.subtract(1, 'day').format('YYYY-MM-DD')}`
      : `${fromKey}=${today.format('YYYY-MM-DD')}&${toKey}=${today.add(dueSoonDays.value, 'day').format('YYYY-MM-DD')}`;
  return `/${currentTenantKey.value}/projects/${projectId}/tasks?${query}`;
};

const taskLink = (t: DashboardTask): string =>
  `/${currentTenantKey.value}/projects/${t.projectId}/tasks?task=${t.seq}`;
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar title="ダッシュボード" icon="i-lucide-gauge">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-settings"
            color="neutral"
            variant="ghost"
            aria-label="ダッシュボード設定"
            @click="settingsOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-4xl space-y-6">
        <p class="text-sm text-muted">閲覧できる全プロジェクトが対象です。</p>

        <DashboardDueSection
          title="期限切れ"
          :basis-label="dateFieldLabel"
          icon="i-lucide-alarm-clock"
          tone="error"
          :groups="overdueGroups"
          :total="due.overdue.length"
          :loading="status === 'pending'"
          :preview-count="PREVIEW_COUNT"
          :expanded-count="EXPANDED_COUNT"
          empty-text="期限切れのタスクはありません"
          :task-link="taskLink"
          :list-link="(projectId: string) => listLink(projectId, 'overdue')"
        >
          <template #meta="{ task }">
            <span class="shrink-0 text-xs tabular-nums text-error">
              {{ daysPast(task) }}日超過
            </span>
          </template>
        </DashboardDueSection>

        <DashboardDueSection
          :title="`期限間近（${dueSoonDays}日以内）`"
          :basis-label="dateFieldLabel"
          icon="i-lucide-clock"
          tone="warning"
          :groups="dueSoonGroups"
          :total="due.dueSoon.length"
          :loading="status === 'pending'"
          :preview-count="PREVIEW_COUNT"
          :expanded-count="EXPANDED_COUNT"
          empty-text="期限間近のタスクはありません"
          :task-link="taskLink"
          :list-link="(projectId: string) => listLink(projectId, 'dueSoon')"
        >
          <template #meta="{ task }">
            <span class="shrink-0 text-xs tabular-nums text-warning">
              {{ daysPast(task) === 0 ? '今日' : `あと${-daysPast(task)}日` }}
            </span>
          </template>
        </DashboardDueSection>
      </div>

      <DashboardSettingsModal
        v-model:open="settingsOpen"
        :settings="settings.dashboard"
        @save="saveSettings"
      />
    </template>
  </UDashboardPanel>
</template>
