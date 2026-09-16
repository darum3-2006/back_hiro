<script setup lang="ts">
import type { DateRangeValue } from '~/components/DateRangeFilter.vue';
import type { FilterItem } from '~/composables/useTaskFilters';

/**
 * 有効なフィルタ 1 件を表すチップ。`ラベル: 値 ✕` の形で、本体クリックで
 * 値の編集ポップオーバーが開く。値の種類（選択肢 / 日付範囲）はここで吸収する。
 *
 * 未使用のフィルタは画面を占有しない、というのがチップ方式の要点なので、
 * 「どのフィルタを出すか」の判断は持たず、出す/消すは親（フィルタバー）が決める。
 */
const props = defineProps<{
  label: string;
  icon?: string;
  /** 選択肢リスト（日付範囲チップでは使わない） */
  items?: FilterItem[];
  /** 含む/除外の 3 状態にするか */
  triState?: boolean;
  searchPlaceholder?: string;
  /** 日付範囲チップにする */
  dateRange?: boolean;
  /** 追加直後に編集ポップオーバーを開いた状態で出す */
  openOnMount?: boolean;
}>();

const emit = defineEmits<{ remove: [] }>();

const include = defineModel<string[]>('include', { default: () => [] });
const exclude = defineModel<string[]>('exclude', { default: () => [] });
const range = defineModel<DateRangeValue>('range', { default: () => ({ from: null, to: null }) });

const open = ref(false);
onMounted(() => {
  // 「+ フィルタ」から足した直後は値が空なので、そのまま値を選べるように開く
  if (props.openOnMount) open.value = true;
});

const labelMap = computed(() => new Map((props.items ?? []).map((i) => [i.value, i.label])));
/** items に無い値（取得対象外のタスクにしか付いていない等）は code のまま出す */
const labelsOf = (values: string[]) => values.map((v) => labelMap.value.get(v) ?? v);

const includeLabels = computed(() => labelsOf(include.value));
const excludeLabels = computed(() => labelsOf(exclude.value));

/** 幅を一定に保つため、2 件目以降は `+N` に畳む。全文は title に出す */
const summarize = (labels: string[]): string =>
  labels.length <= 1 ? (labels[0] ?? '') : `${labels[0]} +${labels.length - 1}`;

const rangeText = computed(() => fmtDateRange(range.value.from, range.value.to));

const hasValue = computed(() =>
  props.dateRange
    ? Boolean(range.value.from || range.value.to)
    : include.value.length > 0 || exclude.value.length > 0,
);

/** ホバー時に出す全文。畳んだ `+N` や除外の中身が読めるようにする */
const fullText = computed(() => {
  if (props.dateRange) return `${props.label}: ${rangeText.value}`;
  const parts: string[] = [];
  if (includeLabels.value.length > 0) parts.push(includeLabels.value.join(', '));
  if (excludeLabels.value.length > 0) parts.push(`除外: ${excludeLabels.value.join(', ')}`);
  return `${props.label}: ${parts.join(' / ')}`;
});
</script>

<template>
  <div
    class="inline-flex items-center rounded-md border text-sm"
    :class="hasValue ? 'border-primary/40 bg-primary/10' : 'border-dashed border-default'"
  >
    <UPopover v-model:open="open" :ui="{ content: dateRange ? 'p-0 w-auto' : 'p-0 w-60' }">
      <button
        type="button"
        class="flex max-w-72 items-center gap-1.5 py-1 pl-2 pr-1"
        :title="hasValue ? fullText : label"
      >
        <UIcon v-if="icon" :name="icon" class="size-3.5 shrink-0 text-dimmed" />
        <span class="shrink-0 text-muted">{{ label }}</span>
        <template v-if="hasValue">
          <span class="text-dimmed">:</span>
          <!-- 日付は書式が固定長なので省略しない。値チップだけ幅を詰める -->
          <span v-if="dateRange" class="whitespace-nowrap">{{ rangeText }}</span>
          <span v-else class="flex min-w-0 items-center gap-1">
            <span v-if="includeLabels.length > 0" class="truncate">
              {{ summarize(includeLabels) }}
            </span>
            <span
              v-if="excludeLabels.length > 0"
              class="flex min-w-0 items-center gap-0.5 text-error"
            >
              <UIcon name="i-lucide-ban" class="size-3.5 shrink-0" />
              <span class="truncate line-through">{{ summarize(excludeLabels) }}</span>
            </span>
          </span>
        </template>
        <span v-else class="text-dimmed">指定なし</span>
        <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 text-dimmed" />
      </button>

      <template #content>
        <DateRangeFilter v-if="dateRange" v-model="range" />
        <FilterValueList
          v-else
          v-model:include="include"
          v-model:exclude="exclude"
          :items="items ?? []"
          :tri-state="triState"
          :search-placeholder="searchPlaceholder"
        />
      </template>
    </UPopover>

    <UButton
      icon="i-lucide-x"
      size="xs"
      color="neutral"
      variant="ghost"
      class="mr-0.5"
      :aria-label="`${label}フィルタを外す`"
      @click="emit('remove')"
    />
  </div>
</template>
