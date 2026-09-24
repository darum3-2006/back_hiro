<script setup lang="ts">
import type { DashboardTask } from '~/types/dashboard';

interface ProjectGroup {
  projectId: string;
  projectName: string;
  tasks: DashboardTask[];
}

const props = defineProps<{
  title: string;
  /** 判定に使っている日付フィールドの表示名。行に出る日付が何かを示す */
  basisLabel: string;
  icon: string;
  tone: 'error' | 'warning';
  groups: ProjectGroup[];
  total: number;
  loading: boolean;
  /** 閉じているときに見せる件数 */
  previewCount: number;
  /** 開いたときの上限。超える分は一覧へ渡す */
  expandedCount: number;
  emptyText: string;
  taskLink: (task: DashboardTask) => string;
  listLink: (projectId: string) => string;
}>();

/**
 * プロジェクトごとの展開状態。既定は閉じ（= previewCount 件だけ見える）。
 * 閉じていても中身が数件見えるので、開閉は「このプロジェクトをもっと見る / 畳む」の意味になる。
 */
const expanded = ref<Set<string>>(new Set());
const isExpanded = (projectId: string) => expanded.value.has(projectId);
const toggle = (projectId: string) => {
  const next = new Set(expanded.value);
  if (next.has(projectId)) next.delete(projectId);
  else next.add(projectId);
  expanded.value = next;
};

const visibleTasks = (g: ProjectGroup): DashboardTask[] =>
  g.tasks.slice(0, isExpanded(g.projectId) ? props.expandedCount : props.previewCount);

/** 表示しきれない残り。0 ならリンクを出さない */
const hiddenCount = (g: ProjectGroup): number => g.tasks.length - visibleTasks(g).length;

const toneClass = computed(() => (props.tone === 'error' ? 'text-error' : 'text-warning'));
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <UIcon :name="icon" class="size-4 shrink-0" :class="toneClass" />
          <span class="font-medium">{{ title }}</span>
          <!-- 行の日付が何の値かは、スクロールしても見えるカード見出しに置く -->
          <span class="truncate text-xs text-muted">基準: {{ basisLabel }}</span>
        </div>
        <span class="shrink-0 text-sm tabular-nums text-muted">{{ total }} 件</span>
      </div>
    </template>

    <div v-if="loading" class="py-6 text-center text-sm text-muted">読み込み中…</div>
    <div v-else-if="groups.length === 0" class="py-6 text-center text-sm text-muted">
      {{ emptyText }}
    </div>

    <div v-else class="space-y-3">
      <div v-for="g in groups" :key="g.projectId" class="rounded-md border border-default">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-t-md bg-elevated/60 px-3 py-2 text-left"
          :aria-expanded="isExpanded(g.projectId)"
          @click="toggle(g.projectId)"
        >
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 shrink-0 text-muted transition-transform"
            :class="isExpanded(g.projectId) ? '' : '-rotate-90'"
          />
          <span class="truncate text-sm font-semibold">{{ g.projectName }}</span>
          <span class="ml-auto shrink-0 text-xs tabular-nums text-muted">
            {{ g.tasks.length }} 件
          </span>
        </button>

        <ul class="divide-y divide-default">
          <li v-for="t in visibleTasks(g)" :key="t.shortCode">
            <NuxtLink
              :to="taskLink(t)"
              class="flex items-center gap-2 px-3 py-1.5 hover:bg-elevated/40"
            >
              <span class="shrink-0 text-xs tabular-nums text-dimmed">#{{ t.seq }}</span>
              <span class="truncate text-sm">{{ t.content }}</span>
              <UBadge
                :color="t.statusColor"
                variant="subtle"
                size="sm"
                :label="t.statusLabel"
                class="ml-auto shrink-0"
              />
              <span class="shrink-0 tabular-nums text-xs text-muted">
                {{ fmtDate(t.targetDate) }}
              </span>
              <slot name="meta" :task="t" />
            </NuxtLink>
          </li>
        </ul>

        <!-- 残りはダッシュボード内で展開せず、絞り込み済みのタスク一覧へ渡す。
             あちらならソート・列選択・フィルタ追加まで使えるため。 -->
        <NuxtLink
          v-if="hiddenCount(g) > 0"
          :to="listLink(g.projectId)"
          class="flex items-center gap-1 px-3 py-1.5 text-xs text-primary hover:underline"
        >
          <UIcon name="i-lucide-arrow-right" class="size-3.5" />
          他 {{ hiddenCount(g) }} 件を一覧で見る
        </NuxtLink>
      </div>
    </div>
  </UCard>
</template>
