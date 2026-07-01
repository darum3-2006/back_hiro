<script setup lang="ts">
import type { Flag, Tag } from '~/types/master';
import type { Member } from '~/types/member';
import type { Task } from '~/types/task';
import { fmtDate } from '~/utils/date';

const props = defineProps<{
  task: Task;
  memberMap: Record<string, Member>;
  tagMap: Record<string, Tag>;
  flagMap: Record<string, Flag>;
  /** 期限超過の強調表示をするか */
  overdue: boolean;
  /** サブタスク進捗（無い場合は表示しない） */
  progress?: { done: number; total: number };
}>();

const assignee = computed(() =>
  props.task.assigneeMemberId
    ? (props.memberMap[props.task.assigneeMemberId]?.displayName ?? null)
    : null,
);

// サブタスク進捗（total > 0 のときだけ表示）
const hasSubtasks = computed(() => (props.progress?.total ?? 0) > 0);
const progressPct = computed(() =>
  props.progress && props.progress.total > 0
    ? Math.round((props.progress.done / props.progress.total) * 100)
    : 0,
);
const allDone = computed(
  () =>
    !!props.progress && props.progress.total > 0 && props.progress.done === props.progress.total,
);
</script>

<template>
  <div
    class="cursor-pointer rounded-md border border-default bg-default p-2 shadow-sm hover:border-primary"
  >
    <div class="flex items-start gap-1.5">
      <span class="shrink-0 text-xs text-muted tabular-nums">#{{ task.seq }}</span>
      <span class="min-w-0 flex-1 text-sm">{{ task.content }}</span>
    </div>

    <div v-if="task.tagCodes.length || task.flagCodes.length" class="mt-1.5 flex flex-wrap gap-1">
      <UBadge
        v-for="c in task.tagCodes"
        :key="`t-${c}`"
        size="xs"
        variant="soft"
        :color="tagMap[c]?.color ?? 'neutral'"
        :label="tagMap[c]?.name ?? c"
      />
      <UBadge
        v-for="c in task.flagCodes"
        :key="`f-${c}`"
        size="xs"
        variant="soft"
        :color="flagMap[c]?.color ?? 'neutral'"
        :label="flagMap[c]?.name ?? c"
      />
    </div>

    <div v-if="hasSubtasks" class="mt-1.5 flex items-center gap-1.5">
      <span
        class="inline-flex items-center gap-0.5 text-xs tabular-nums"
        :class="allDone ? 'text-success' : 'text-muted'"
      >
        <UIcon name="i-lucide-list-todo" class="size-3" />
        {{ progress!.done }}/{{ progress!.total }}
      </span>
      <div class="h-1 flex-1 overflow-hidden rounded-full bg-elevated">
        <div
          class="h-full rounded-full transition-all"
          :class="allDone ? 'bg-success' : 'bg-primary'"
          :style="{ width: `${progressPct}%` }"
        />
      </div>
    </div>

    <div class="mt-1.5 flex items-center gap-2 text-xs text-muted">
      <span v-if="assignee" class="inline-flex min-w-0 items-center gap-1">
        <UIcon name="i-lucide-user" class="size-3 shrink-0" />
        <span class="truncate">{{ assignee }}</span>
      </span>
      <span
        v-if="task.deadline"
        class="inline-flex items-center gap-1"
        :class="overdue ? 'font-medium text-error' : undefined"
      >
        <UIcon name="i-lucide-calendar" class="size-3" />
        {{ fmtDate(task.deadline) }}
      </span>
      <span v-if="task.commentCount > 0" class="ml-auto inline-flex items-center gap-0.5">
        <UIcon name="i-lucide-message-square" class="size-3" />
        {{ task.commentCount }}
      </span>
    </div>
  </div>
</template>
