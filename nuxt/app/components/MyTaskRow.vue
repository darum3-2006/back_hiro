<script setup lang="ts">
import type { MyTask } from '~/types/task';

const props = defineProps<{ task: MyTask; overdue?: boolean }>();

const tenantKey = useCurrentTenantKey();
// 共有コードのルート（/:tenantKey/:shortCode）に飛ばせば、所属プロジェクトを
// 解決してタスク詳細が開く。プロジェクト横断のダッシュボードから直接リンクできる。
const to = computed(() => `/${tenantKey.value}/${props.task.shortCode}`);
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-elevated/50 transition-colors"
  >
    <span class="shrink-0 font-mono text-xs text-muted">#{{ task.seq }}</span>
    <span class="flex-1 truncate text-sm">{{ task.content }}</span>
    <UBadge color="neutral" variant="soft" size="sm" :label="task.statusLabel" />
    <span
      class="w-24 shrink-0 text-center text-xs"
      :class="overdue ? 'font-medium text-error' : 'text-muted'"
      >{{ fmtDate(task.deadline) }}</span
    >
  </NuxtLink>
</template>
