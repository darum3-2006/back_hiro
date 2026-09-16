<script setup lang="ts">
import type { FilterItem } from '~/composables/useTaskFilters';

/**
 * フィルタの選択肢リスト（検索 + 項目）。トリガーを持たないので、
 * チップのポップオーバー等の中身としてそのまま置ける。
 *
 * - `triState` false: 未選択 ⇄ 含む の 2 状態。単値フィールド用
 *   （1 タスクが 1 つしか値を持たないので、「含む」の選択が実質の除外を兼ねる）
 * - `triState` true : 未選択 → 含む ✓ → 除外 ⊘ の 3 状態。多値フィールド用
 */
const props = defineProps<{
  items: FilterItem[];
  searchPlaceholder?: string;
  /** 3 状態（含む/除外）にするか */
  triState?: boolean;
}>();

/** 含む。いずれかに一致するタスクのみ表示(OR) */
const include = defineModel<string[]>('include', { required: true });
/** 除外。1つでも持つタスクは隠す。triState false のときは使わない */
const exclude = defineModel<string[]>('exclude', { default: () => [] });

const query = ref('');
const filteredItems = computed(() => {
  const q = query.value.trim().toLowerCase();
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
  if (!props.triState) {
    include.value = state === 'include' ? inc : [...inc, value];
    return;
  }
  include.value = state === 'none' ? [...inc, value] : inc;
  exclude.value = state === 'include' ? [...exc, value] : exc;
};

const nextActionLabel = (value: string): string => {
  const state = stateOf(value);
  if (!props.triState) return state === 'include' ? '選択を解除' : '絞り込みに追加';
  return state === 'none' ? '含むに設定' : state === 'include' ? '除外に設定' : '選択を解除';
};
</script>

<template>
  <div>
    <div class="border-b border-default p-1">
      <UInput
        v-model="query"
        :placeholder="searchPlaceholder ?? '検索…'"
        icon="i-lucide-search"
        size="sm"
        variant="none"
        autofocus
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
  </div>
</template>
