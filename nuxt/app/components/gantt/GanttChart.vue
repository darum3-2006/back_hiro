<script setup lang="ts">
import type { GanttScale } from '~/composables/useGanttScale';
import type { TaskStatus } from '~/types/master';
import type { Task } from '~/types/task';
import {
  ganttBarBorderClass,
  ganttBarColorClass,
  ganttTextColorClass,
  hasPlannedBar,
  type GanttGroup,
} from '~/utils/gantt';

const props = defineProps<{
  groups: GanttGroup[];
  scale: GanttScale;
  statusMap: Record<string, TaskStatus>;
  /** グループ見出しを表示するか（groupBy !== 'none'） */
  showGroupHeader: boolean;
  /** 選択中タスクに関連するタスク id（G2: ハイライト） */
  relatedIds?: Set<string>;
  /** 依存違反のあるタスク id（G3: 警告） */
  violatedIds?: Set<string>;
}>();

const emit = defineEmits<{ select: [Task] }>();

const isRelated = (task: Task): boolean => props.relatedIds?.has(task.id) ?? false;
const isViolated = (task: Task): boolean => props.violatedIds?.has(task.id) ?? false;
/** 完了扱い（ステータスマスタの isTerminal）。完了タスク表示時に見分けられるよう中抜きで描く */
const isDone = (task: Task): boolean => props.statusMap[task.statusCode]?.isTerminal ?? false;
/**
 * バーの塗り。未完了はステータス色で塗りつぶし、完了は塗らずにステータス色の枠線だけ（中抜き）にする。
 * 色ではなく形で分けるので、ステータス色の組み合わせによらず見分けられ、完了が多くてもうるさくならない。
 */
const barFillClass = (task: Task): string => {
  const color = props.statusMap[task.statusCode]?.color;
  return isDone(task)
    ? `border-2 bg-default text-default ${ganttBarBorderClass(color)}`
    : `text-white shadow-sm ${ganttBarColorClass(color)}`;
};
/** 完了タスクの印（チェックアイコン・期限の ▼）の色。完了扱いステータスに設定された色に合わせる */
const doneIconClass = (task: Task): string =>
  ganttTextColorClass(props.statusMap[task.statusCode]?.color);
// バーの枠線: 依存違反(赤) > 関連ハイライト(primary) の優先
const ringClass = (task: Task): string =>
  isViolated(task)
    ? 'ring-2 ring-error'
    : isRelated(task)
      ? 'ring-2 ring-primary ring-offset-1 ring-offset-default'
      : '';

// ref / 関数を分割代入（ref は識別子が安定なのでリアクティブ維持。template で自動 unwrap）
const { totalWidth, ticks, todayX, xOf, widthOf } = props.scale;

const LABEL_W = 280;
const ROW_H = 36;
const HEAD_H = 32;
const BAR_H = 20;

// 着手予定/完了予定のどちらかが欠けていても、もう片方で補って描く（片方だけ＝1 日幅の点）。
// 月粒度で 1 日が極小になっても見える/押せるよう、最小幅を確保する。
const MIN_BAR_W = 8;
const barStyle = (task: Task) => {
  const from = task.plannedStartDate ?? task.plannedCompletionDate;
  const to = task.plannedCompletionDate ?? task.plannedStartDate;
  return {
    left: `${xOf(from) ?? 0}px`,
    width: `${Math.max(widthOf(from, to), MIN_BAR_W)}px`,
    top: `${(ROW_H - BAR_H) / 2}px`,
    height: `${BAR_H}px`,
  };
};
</script>

<template>
  <div class="overflow-x-auto text-sm">
    <div :style="{ minWidth: `${LABEL_W + totalWidth}px` }">
      <!-- ヘッダ（時間軸の目盛り） -->
      <div class="flex">
        <div
          class="shrink-0 sticky left-0 z-30 bg-elevated border-r border-b border-default"
          :style="{ width: `${LABEL_W}px`, height: `${HEAD_H}px` }"
        />
        <div
          class="relative bg-elevated border-b border-default"
          :style="{ width: `${totalWidth}px`, height: `${HEAD_H}px` }"
        >
          <div
            v-for="t in ticks"
            :key="t.x"
            class="absolute top-0 h-full border-l px-1 text-[10px] leading-8 text-muted whitespace-nowrap"
            :class="t.major ? 'border-default font-medium' : 'border-default/40'"
            :style="{ left: `${t.x}px` }"
          >
            {{ t.label }}
          </div>
        </div>
      </div>

      <!-- グループ + タスク行 -->
      <template v-for="g in groups" :key="g.key">
        <div v-if="showGroupHeader" class="flex">
          <div
            class="shrink-0 sticky left-0 z-10 flex items-center gap-2 bg-muted/40 border-r border-b border-default px-3 py-1 font-medium"
            :style="{ width: `${LABEL_W}px` }"
          >
            <span
              v-if="g.color"
              class="size-2 rounded-full shrink-0"
              :class="ganttBarColorClass(g.color)"
            />
            <span class="truncate">{{ g.label || '（その他）' }}</span>
            <span class="text-xs text-muted">{{ g.tasks.length }}</span>
          </div>
          <div class="bg-muted/40 border-b border-default" :style="{ width: `${totalWidth}px` }" />
        </div>

        <div v-for="task in g.tasks" :key="task.id" class="flex group/row">
          <div
            class="shrink-0 sticky left-0 z-10 flex items-center gap-2 bg-default border-r border-b border-default px-3 cursor-pointer group-hover/row:bg-elevated/60"
            :style="{ width: `${LABEL_W}px`, height: `${ROW_H}px` }"
            @click="emit('select', task)"
          >
            <span class="shrink-0 text-xs text-muted tabular-nums">#{{ task.seq }}</span>
            <UIcon
              v-if="isDone(task)"
              name="i-lucide-circle-check"
              class="size-3.5 shrink-0"
              :class="doneIconClass(task)"
              title="完了"
            />
            <span class="truncate" :class="{ 'line-through text-muted': isDone(task) }">
              {{ task.content }}
            </span>
            <UIcon
              v-if="isViolated(task)"
              name="i-lucide-triangle-alert"
              class="ml-auto size-3.5 shrink-0 text-error"
              title="先行/ブロック元の完了予定より早く着手予定になっています"
            />
          </div>
          <div
            class="relative border-b border-default group-hover/row:bg-elevated/30"
            :style="{ width: `${totalWidth}px`, height: `${ROW_H}px` }"
          >
            <div
              v-if="todayX !== null"
              class="absolute top-0 bottom-0 w-px bg-primary/50 pointer-events-none"
              :style="{ left: `${todayX}px` }"
            />
            <button
              v-if="hasPlannedBar(task)"
              type="button"
              class="absolute flex items-center gap-1 overflow-hidden rounded px-1 text-left text-xs"
              :class="[barFillClass(task), ringClass(task)]"
              :style="barStyle(task)"
              :title="
                isViolated(task)
                  ? '先行/ブロック元の完了予定より早く着手予定になっています'
                  : isDone(task)
                    ? `（完了）${task.content}`
                    : task.content
              "
              @click="emit('select', task)"
            >
              <UIcon
                v-if="isDone(task)"
                name="i-lucide-check"
                class="size-3 shrink-0"
                :class="doneIconClass(task)"
              />
              <span class="truncate">{{ task.content }}</span>
            </button>
            <!-- 完了済みは期限を過ぎていても警告ではないので、赤ではなく完了ステータスの色にする -->
            <div
              v-if="xOf(task.deadline) !== null"
              class="absolute -translate-x-1/2 text-xs pointer-events-none"
              :class="isDone(task) ? doneIconClass(task) : 'text-error'"
              :style="{ left: `${xOf(task.deadline)}px`, top: '0px' }"
              title="期限"
            >
              ▼
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
