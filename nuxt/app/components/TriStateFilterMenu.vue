<script setup lang="ts">
export interface TriStateFilterItem {
  label: string;
  value: string;
}

/**
 * 3状態(未選択 → 含む ✓ → 除外 ⊘)を項目クリックで循環させるフィルタメニュー。
 * タグ・フラグのような「1タスクが複数値を持つ」フィールド用。単値フィールドでは
 * 「含む」の選択が実質の除外を兼ねるため、このコンポーネントは使わない。
 */
const props = defineProps<{
  items: TriStateFilterItem[];
  /** 未選択時にトリガーへ表示するラベル */
  placeholder: string;
  icon?: string;
  searchPlaceholder?: string;
}>();

/** 含む(✓)の値。いずれかを持つタスクのみ表示(OR) */
const include = defineModel<string[]>('include', { required: true });
/** 除外(⊘)の値。1つでも持つタスクは隠す */
const exclude = defineModel<string[]>('exclude', { required: true });

const query = ref('');
const filteredItems = computed(() => {
  const q = query.value.toLowerCase();
  if (!q) return props.items;
  return props.items.filter((i) => i.label.toLowerCase().includes(q));
});

type ItemState = 'none' | 'include' | 'exclude';
const stateOf = (value: string): ItemState =>
  include.value.includes(value) ? 'include' : exclude.value.includes(value) ? 'exclude' : 'none';

// 両モデルから必ず除いてから片方に足す（冪等）。URL 同期の競合等で万一
// 両方に同じ値が紛れ込んでも、次のクリックで矛盾なく復帰できる。
const cycle = (value: string) => {
  const state = stateOf(value);
  const inc = include.value.filter((v) => v !== value);
  const exc = exclude.value.filter((v) => v !== value);
  include.value = state === 'none' ? [...inc, value] : inc;
  exclude.value = state === 'include' ? [...exc, value] : exc;
};

const nextActionLabel = (value: string): string => {
  const state = stateOf(value);
  return state === 'none' ? '含むに設定' : state === 'include' ? '除外に設定' : '選択を解除';
};

// トリガー表示用。items に無い値(取得対象外のタスクにしか付いていない等)は code で出す
const labelMap = computed(() => new Map(props.items.map((i) => [i.value, i.label])));
const includeLabels = computed(() => include.value.map((v) => labelMap.value.get(v) ?? v));
const excludeLabels = computed(() => exclude.value.map((v) => labelMap.value.get(v) ?? v));
const isActive = computed(() => include.value.length > 0 || exclude.value.length > 0);
</script>

<template>
  <UPopover :ui="{ content: 'p-0 w-60' }">
    <button
      type="button"
      class="flex w-44 items-center gap-1.5 rounded-md border border-default bg-default px-2.5 py-1.5 text-sm transition-colors hover:bg-elevated/50"
    >
      <UIcon v-if="icon" :name="icon" class="size-4 shrink-0 text-dimmed" />
      <span v-if="!isActive" class="truncate text-dimmed">{{ placeholder }}</span>
      <span v-else class="flex min-w-0 items-center gap-1">
        <span v-if="includeLabels.length > 0" class="truncate">{{ includeLabels.join(', ') }}</span>
        <span
          v-if="excludeLabels.length > 0"
          class="flex min-w-0 items-center gap-0.5 text-error"
          :title="`除外: ${excludeLabels.join(', ')}`"
        >
          <UIcon name="i-lucide-ban" class="size-3.5 shrink-0" />
          <span class="truncate line-through">{{ excludeLabels.join(', ') }}</span>
        </span>
      </span>
      <UIcon name="i-lucide-chevron-down" class="ml-auto size-4 shrink-0 text-dimmed" />
    </button>

    <template #content>
      <div class="border-b border-default p-1">
        <UInput
          v-model="query"
          :placeholder="searchPlaceholder ?? '検索…'"
          icon="i-lucide-search"
          size="sm"
          variant="none"
        />
      </div>
      <div class="max-h-64 overflow-y-auto p-1">
        <button
          v-for="item in filteredItems"
          :key="item.value"
          type="button"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-elevated/50"
          :aria-label="`${item.label}: ${nextActionLabel(item.value)}`"
          @click="cycle(item.value)"
        >
          <span class="flex size-4 shrink-0 items-center justify-center">
            <UIcon
              v-if="stateOf(item.value) === 'include'"
              name="i-lucide-check"
              class="size-4 text-primary"
            />
            <UIcon
              v-else-if="stateOf(item.value) === 'exclude'"
              name="i-lucide-ban"
              class="size-4 text-error"
            />
          </span>
          <span
            class="truncate"
            :class="stateOf(item.value) === 'exclude' ? 'text-error line-through' : ''"
          >
            {{ item.label }}
          </span>
        </button>
        <p v-if="filteredItems.length === 0" class="px-2 py-4 text-center text-xs text-muted">
          該当する項目がありません
        </p>
      </div>
      <p class="border-t border-default px-2.5 py-1.5 text-[11px] text-muted">
        クリックで切替: 含む ✓ → 除外 ⊘ → 解除
      </p>
    </template>
  </UPopover>
</template>
