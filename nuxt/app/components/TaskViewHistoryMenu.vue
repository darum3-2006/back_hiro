<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import type { TaskViewEntry } from '~/types/task-view';

// 自分が最近開いたタスクの履歴（全プロジェクト横断）。開いたときに取り直すので、
// 別の画面で見たタスクもメニューを開けば反映される。
const { data: entries, status, refresh } = useMyTaskViews();
const currentTenantKey = useCurrentTenantKey();

const open = ref(false);
watch(open, (v) => {
  if (v) void refresh();
});

// G → H の順に押して開く。修飾キーを使わないので OS・ブラウザのショートカットと衝突せず
// （Mac の ⌘+H は「アプリを隠す」でページに届かない）、Mac と Windows で同じ操作になる。
// 2 つ目のキーは 0.8 秒以内。入力欄にフォーカスがあるときは反応しない（defineShortcuts の既定）
defineShortcuts({
  'g-h': () => {
    open.value = true;
  },
});

const route = useRoute();
const currentProjectId = useCurrentProjectId();

// 同じプロジェクトの一覧にいるときは、フィルタ・ソート・ビュー・列状態のクエリを保ったまま
// task だけ差し替える（クエリ全体を置き換えると再マウントされないため復元も走らず、
// 絞り込みが消えて記憶したフィルタまでクリアされてしまう）。
// 別プロジェクトへは素の遷移にして、遷移先の一覧側の復元（前回ビュー / 記憶したフィルタ）に任せる。
const linkOf = (e: TaskViewEntry): RouteLocationRaw => {
  const path = `/${currentTenantKey.value}/projects/${e.projectId}/tasks`;
  const task = String(e.seq);
  if (e.projectId === currentProjectId.value) {
    return { path, query: { ...route.query, task } };
  }
  return { path, query: { task } };
};
</script>

<template>
  <UPopover v-model:open="open" :ui="{ content: 'p-0 w-96' }">
    <UTooltip text="閲覧履歴" :kbds="['g', 'h']">
      <UButton color="neutral" variant="outline" icon="i-lucide-history" aria-label="閲覧履歴" />
    </UTooltip>

    <template #content>
      <div class="border-b border-default px-3 py-2">
        <p class="text-sm font-medium">閲覧履歴</p>
        <p class="text-xs text-muted">最近開いたタスク（全プロジェクト・直近 30 件）</p>
      </div>

      <div class="max-h-96 overflow-y-auto p-1">
        <p
          v-if="status === 'pending' && entries.length === 0"
          class="px-2 py-6 text-center text-xs text-muted"
        >
          読み込み中…
        </p>
        <p v-else-if="entries.length === 0" class="px-2 py-6 text-center text-xs text-muted">
          まだ閲覧したタスクはありません
        </p>

        <NuxtLink
          v-for="e in entries"
          :key="e.shortCode"
          :to="linkOf(e)"
          class="block rounded px-2 py-1.5 hover:bg-elevated/50"
          @click="open = false"
        >
          <div class="flex items-center gap-1.5">
            <span class="shrink-0 text-xs tabular-nums text-dimmed">#{{ e.seq }}</span>
            <span class="truncate text-sm">{{ e.content }}</span>
          </div>
          <div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span class="truncate">{{ e.projectName }}</span>
            <UBadge
              :color="e.statusColor"
              variant="subtle"
              size="sm"
              :label="e.statusLabel"
              class="shrink-0"
            />
            <span class="ml-auto shrink-0 tabular-nums">{{ fmtRelative(e.viewedAt) }}</span>
          </div>
        </NuxtLink>
      </div>
    </template>
  </UPopover>
</template>
