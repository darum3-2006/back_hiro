<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus';
import type { Flag, Tag, TaskStatus } from '~/types/master';
import type { Member } from '~/types/member';
import type { Task } from '~/types/task';

const props = defineProps<{
  statuses: TaskStatus[];
  /** 絞り込み済みタスク（completed の有無はフィルタ側で制御済み） */
  tasks: Task[];
  memberMap: Record<string, Member>;
  tagMap: Record<string, Tag>;
  flagMap: Record<string, Flag>;
  isOverdue: (t: Task) => boolean;
  /** タスク id → サブタスク進捗 */
  progressMap: Record<string, { done: number; total: number }>;
}>();

const emit = defineEmits<{
  open: [Task];
  move: [{ task: Task; toStatusCode: string }];
}>();

interface Column {
  status: TaskStatus | null;
  key: string;
  label: string;
  tasks: Task[];
}

// ステータス順に列を作る。マスタに無い statusCode のタスクは末尾「未分類」列へ（移動先にはできない）。
const cols = ref<Column[]>([]);
const rebuild = () => {
  const ordered = [...props.statuses].sort((a, b) => a.order - b.order);
  const known = new Set(ordered.map((s) => s.code));
  const next: Column[] = ordered.map((s) => ({
    status: s,
    key: s.code,
    label: s.label,
    tasks: props.tasks.filter((t) => t.statusCode === s.code),
  }));
  const orphans = props.tasks.filter((t) => !known.has(t.statusCode));
  if (orphans.length > 0) {
    next.push({ status: null, key: '__unknown__', label: '未分類', tasks: orphans });
  }
  cols.value = next;
};
watch([() => props.tasks, () => props.statuses], rebuild, { immediate: true });

// ドラッグ中タスク（@start で源の列・index から確定）
const dragging = ref<Task | null>(null);
const onStart = (col: Column, e: { oldIndex?: number }) => {
  dragging.value = e.oldIndex != null ? (col.tasks[e.oldIndex] ?? null) : null;
};
const onAdd = (col: Column) => {
  if (dragging.value && col.status) {
    emit('move', { task: dragging.value, toStatusCode: col.status.code });
  }
  dragging.value = null;
};
</script>

<template>
  <div class="flex h-full gap-3 overflow-x-auto p-4">
    <div
      v-for="col in cols"
      :key="col.key"
      class="flex max-h-full w-72 shrink-0 flex-col rounded-lg bg-elevated/30"
    >
      <div class="flex items-center gap-2 px-3 py-2">
        <UBadge
          :color="col.status?.color ?? 'neutral'"
          variant="soft"
          size="sm"
          :label="col.label"
        />
        <span class="text-xs text-muted">{{ col.tasks.length }}</span>
      </div>
      <VueDraggable
        v-model="col.tasks"
        :group="col.status ? { name: 'board' } : { name: 'board', put: false }"
        :animation="150"
        :sort="false"
        class="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
        @start="(e: { oldIndex?: number }) => onStart(col, e)"
        @add="() => onAdd(col)"
      >
        <KanbanCard
          v-for="t in col.tasks"
          :key="t.id"
          :task="t"
          :member-map="memberMap"
          :tag-map="tagMap"
          :flag-map="flagMap"
          :overdue="isOverdue(t)"
          :progress="progressMap[t.id]"
          @click="emit('open', t)"
        />
      </VueDraggable>
    </div>

    <p v-if="cols.length === 0" class="p-4 text-sm text-muted">
      ステータスが定義されていません。プロジェクト設定でステータスを追加してください。
    </p>
  </div>
</template>
