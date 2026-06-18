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
}>();

const assignee = computed(() =>
  props.task.assigneeMemberId
    ? (props.memberMap[props.task.assigneeMemberId]?.displayName ?? null)
    : null,
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
