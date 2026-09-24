<script setup lang="ts">
import dayjs from 'dayjs';
import type { DashboardTask } from '~/types/dashboard';
import { DASHBOARD_DATE_FIELD_LABELS, type DashboardSettings } from '~/types/user-settings';

// チーム全体の状況をプロジェクト横断で見るダッシュボード。
// ホーム（/[tenantKey]）が「自分の担当タスク」なのに対し、こちらは
// 閲覧できる全タスクが対象で、遅れや動きのないタスクに気づくための画面。
const route = useRoute();
const router = useRouter();
const { settings, update } = useMySettings();
const currentTenantKey = useCurrentTenantKey();

const dateField = computed(() => settings.value.dashboard.dateField);
const dueSoonDays = computed(() => settings.value.dashboard.dueSoonDays);
const inactiveDays = computed(() => settings.value.dashboard.inactiveDays);
const { data: due, status: dueStatus } = useDueTasks({ dateField, dueSoonDays });
const { data: inactive, status: inactiveStatus } = useInactiveTasks({ inactiveDays });

const settingsOpen = ref(false);
const saveSettings = async (patch: Partial<DashboardSettings>) => {
  await update({ dashboard: patch });
};

const dateFieldLabel = computed(() => DASHBOARD_DATE_FIELD_LABELS[dateField.value]);

// ===== タブ（URL の ?tab= で受け渡す。共有リンクで特定のタブを開けるように） =====
// クエリの値は表示名と切り離した英語キー。表示名を変えても既存の共有リンクが壊れない。
const TAB_KEYS = ['overdue', 'due-soon', 'inactive'] as const;
type TabKey = (typeof TAB_KEYS)[number];
/** 既定は最も対応が急がれる期限切れ */
const DEFAULT_TAB: TabKey = 'overdue';

const activeTab = computed<TabKey>({
  get: () => {
    const q = route.query.tab;
    return TAB_KEYS.includes(q as TabKey) ? (q as TabKey) : DEFAULT_TAB;
  },
  // フィルタと同じく replace（タブの切り替えで履歴を積まない）。既定タブは URL を汚さない
  set: (v) => {
    const { tab: _drop, ...rest } = route.query;
    void router.replace({ query: v === DEFAULT_TAB ? rest : { ...rest, tab: v } });
  },
});

// 中身は選んだタブしか見えないので、件数はタブのバッジに常に出して全体像を保つ
const tabs = computed(() => [
  {
    label: '期限切れ',
    value: 'overdue' as const,
    icon: 'i-lucide-alarm-clock',
    badge: {
      label: String(due.value.overdue.length),
      color: 'error' as const,
      variant: 'subtle' as const,
    },
    slot: 'overdue' as const,
  },
  {
    label: '期限間近',
    value: 'due-soon' as const,
    icon: 'i-lucide-clock',
    badge: {
      label: String(due.value.dueSoon.length),
      color: 'warning' as const,
      variant: 'subtle' as const,
    },
    slot: 'due-soon' as const,
  },
  {
    label: '動きなし',
    value: 'inactive' as const,
    icon: 'i-lucide-pause',
    badge: {
      label: String(inactive.value.length),
      color: 'neutral' as const,
      variant: 'subtle' as const,
    },
    slot: 'inactive' as const,
  },
]);

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
const inactiveGroups = computed(() => groupByProject(inactive.value));

/** 基準日から何日過ぎたか。負なら残り日数 */
const daysPast = (t: DashboardTask): number =>
  dayjs().startOf('day').diff(dayjs(t.targetDate), 'day');

// ===== 絞り込み済みタスク一覧へのリンク（クエリキーはタスク一覧のフィルタと同じ） =====
const DATE_QUERY_KEYS = {
  deadline: ['deadlineFrom', 'deadlineTo'],
  plannedStart: ['plannedStartFrom', 'plannedStartTo'],
  plannedCompletion: ['plannedCompletionFrom', 'plannedCompletionTo'],
  plannedRelease: ['plannedReleaseFrom', 'plannedReleaseTo'],
} as const;

const tasksPath = (projectId: string) => `/${currentTenantKey.value}/projects/${projectId}/tasks`;

const dueListLink = (projectId: string, kind: 'overdue' | 'dueSoon'): string => {
  const [fromKey, toKey] = DATE_QUERY_KEYS[dateField.value];
  const today = dayjs().startOf('day');
  const query =
    kind === 'overdue'
      ? `${toKey}=${today.subtract(1, 'day').format('YYYY-MM-DD')}`
      : `${fromKey}=${today.format('YYYY-MM-DD')}&${toKey}=${today.add(dueSoonDays.value, 'day').format('YYYY-MM-DD')}`;
  return `${tasksPath(projectId)}?${query}`;
};

/**
 * 動きなしの一覧リンク。ステータス更新日時だけで絞ると、一覧側には「初期ステータスを除く」
 * フィルタが無いため未着手のタスクまで混ざり、件数が食い違う。そのプロジェクトの
 * 動きなしタスクに現れるステータスを status= に並べて、飛び先と件数を揃える。
 */
const inactiveListLink = (projectId: string): string => {
  const g = inactiveGroups.value.find((x) => x.projectId === projectId);
  const codes = [...new Set((g?.tasks ?? []).map((t) => t.statusCode))];
  // SQL は「N 日前の 0 時より前」なので、日付では N+1 日前まで
  const to = dayjs()
    .startOf('day')
    .subtract(inactiveDays.value + 1, 'day')
    .format('YYYY-MM-DD');
  return `${tasksPath(projectId)}?statusChangedTo=${to}&status=${codes.join(',')}`;
};

/**
 * 行クリックのリンク。各タブの「他X件を一覧で見る」と同じ絞り込みで一覧を開き、
 * そのタスクの詳細も開く。詳細を閉じたあと、同じ条件の他のタスクを続けて見られるように。
 */
const withTask = (listUrl: string, t: DashboardTask): string => `${listUrl}&task=${t.seq}`;

const overdueTaskLink = (t: DashboardTask) => withTask(dueListLink(t.projectId, 'overdue'), t);
const dueSoonTaskLink = (t: DashboardTask) => withTask(dueListLink(t.projectId, 'dueSoon'), t);
const inactiveTaskLink = (t: DashboardTask) => withTask(inactiveListLink(t.projectId), t);
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
      <div class="mx-auto w-full max-w-4xl space-y-4">
        <p class="text-sm text-muted">閲覧できる全プロジェクトが対象です。</p>

        <UTabs v-model="activeTab" :items="tabs" variant="link" class="w-full">
          <template #overdue>
            <DashboardDueSection
              title="期限切れ"
              :basis-label="dateFieldLabel"
              icon="i-lucide-alarm-clock"
              tone="error"
              :groups="overdueGroups"
              :total="due.overdue.length"
              :loading="dueStatus === 'pending'"
              :preview-count="PREVIEW_COUNT"
              :expanded-count="EXPANDED_COUNT"
              empty-text="期限切れのタスクはありません"
              :task-link="overdueTaskLink"
              :list-link="(projectId: string) => dueListLink(projectId, 'overdue')"
            >
              <template #meta="{ task }">
                <span class="shrink-0 text-xs tabular-nums text-error">
                  {{ daysPast(task) }}日超過
                </span>
              </template>
            </DashboardDueSection>
          </template>

          <template #due-soon>
            <DashboardDueSection
              :title="`期限間近（${dueSoonDays}日以内）`"
              :basis-label="dateFieldLabel"
              icon="i-lucide-clock"
              tone="warning"
              :groups="dueSoonGroups"
              :total="due.dueSoon.length"
              :loading="dueStatus === 'pending'"
              :preview-count="PREVIEW_COUNT"
              :expanded-count="EXPANDED_COUNT"
              empty-text="期限間近のタスクはありません"
              :task-link="dueSoonTaskLink"
              :list-link="(projectId: string) => dueListLink(projectId, 'dueSoon')"
            >
              <template #meta="{ task }">
                <span class="shrink-0 text-xs tabular-nums text-warning">
                  {{ daysPast(task) === 0 ? '今日' : `あと${-daysPast(task)}日` }}
                </span>
              </template>
            </DashboardDueSection>
          </template>

          <template #inactive>
            <DashboardDueSection
              :title="`ステータスが${inactiveDays}日以上変わっていないタスク`"
              icon="i-lucide-pause"
              tone="neutral"
              :groups="inactiveGroups"
              :total="inactive.length"
              :loading="inactiveStatus === 'pending'"
              :preview-count="PREVIEW_COUNT"
              :expanded-count="EXPANDED_COUNT"
              empty-text="動きのないタスクはありません"
              :task-link="inactiveTaskLink"
              :list-link="inactiveListLink"
            >
              <template #meta="{ task }">
                <span class="shrink-0 text-xs tabular-nums text-muted">
                  {{ daysPast(task) }}日動きなし
                </span>
              </template>
            </DashboardDueSection>
          </template>
        </UTabs>
      </div>

      <DashboardSettingsModal
        v-model:open="settingsOpen"
        :settings="settings.dashboard"
        @save="saveSettings"
      />
    </template>
  </UDashboardPanel>
</template>
