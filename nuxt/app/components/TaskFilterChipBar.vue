<script setup lang="ts">
import type { TaskFilters } from '~/composables/useTaskFilters';

const props = defineProps<{
  filters: TaskFilters;
  /** 全件数 / 絞り込み後件数（既定の件数表示用。#count を使う場合は不要） */
  total?: number;
  filtered?: number;
}>();

// 値はすべて ref / computed / 関数 / 安定配列なので、分割代入してもリアクティブは保たれる。
const { search, showCompleted, statusFilter, hasActiveFilter, resetFilters, chipFilters } =
  props.filters;

/**
 * 「+ フィルタ」から足したが、まだ値が空のフィルタのキー。
 * チップは本来「値が入っているフィルタ」だけを出すが、それだけだと追加操作が
 * 何も起きないように見えるため、値が入るまでの間だけここで覚えて表示する。
 * URL には載せない（空のフィルタは共有・保存する意味がないため）。
 */
const pendingKeys = ref<string[]>([]);
/** 追加直後に編集ポップオーバーを自動で開くのは 1 回だけ。その対象 */
const justAddedKey = ref<string | null>(null);

const visibleFilters = computed(() =>
  chipFilters.filter((f) => f.isActive.value || pendingKeys.value.includes(f.key)),
);

const addableFilters = computed(() =>
  chipFilters.filter((f) => !f.isActive.value && !pendingKeys.value.includes(f.key)),
);

const addQuery = ref('');
const addableMatches = computed(() => {
  const q = addQuery.value.trim().toLowerCase();
  if (!q) return addableFilters.value;
  return addableFilters.value.filter((f) => f.label.toLowerCase().includes(q));
});

const addOpen = ref(false);
const addFilter = (key: string) => {
  if (!pendingKeys.value.includes(key)) pendingKeys.value = [...pendingKeys.value, key];
  justAddedKey.value = key;
  addOpen.value = false;
  addQuery.value = '';
};

const removeFilter = (key: string) => {
  const target = chipFilters.find((f) => f.key === key);
  target?.clear();
  pendingKeys.value = pendingKeys.value.filter((k) => k !== key);
  if (justAddedKey.value === key) justAddedKey.value = null;
};

const clearAll = () => {
  resetFilters();
  pendingKeys.value = [];
  justAddedKey.value = null;
};
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3">
    <UInput
      v-model="search"
      placeholder="内容を検索"
      icon="i-lucide-search"
      class="min-w-64"
      :ui="{ trailing: 'pe-1' }"
    >
      <template v-if="search" #trailing>
        <UButton
          icon="i-lucide-x"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="検索内容をクリア"
          @click="search = ''"
        />
      </template>
    </UInput>

    <!-- 有効なフィルタだけがチップとして出る。未使用のフィルタは場所を取らない -->
    <template v-for="f in visibleFilters" :key="f.key">
      <TaskFilterChip
        v-if="f.kind === 'date'"
        v-model:range="f.range.value"
        :label="f.chipLabel"
        :icon="f.icon"
        date-range
        :open-on-mount="justAddedKey === f.key"
        @remove="removeFilter(f.key)"
      />
      <TaskFilterChip
        v-else
        v-model:include="f.include.value"
        v-model:exclude="f.exclude.value"
        :label="f.chipLabel"
        :icon="f.icon"
        :items="f.items.value"
        :tri-state="f.triState"
        :search-placeholder="`${f.label}を検索…`"
        :open-on-mount="justAddedKey === f.key"
        @remove="removeFilter(f.key)"
      />
    </template>

    <UPopover v-model:open="addOpen" :ui="{ content: 'p-0 w-56' }">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        label="フィルタ"
        :disabled="addableFilters.length === 0"
      />
      <template #content>
        <div class="border-b border-default p-1">
          <UInput
            v-model="addQuery"
            placeholder="フィルタ名で検索…"
            icon="i-lucide-search"
            size="sm"
            variant="none"
            autofocus
          />
        </div>
        <div class="max-h-72 overflow-y-auto p-1">
          <button
            v-for="f in addableMatches"
            :key="f.key"
            type="button"
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-elevated/50"
            @click="addFilter(f.key)"
          >
            <UIcon
              :name="f.icon ?? (f.kind === 'date' ? 'i-lucide-calendar-range' : 'i-lucide-filter')"
              class="size-4 shrink-0 text-dimmed"
            />
            <span class="truncate">{{ f.label }}</span>
          </button>
          <p v-if="addableMatches.length === 0" class="px-2 py-4 text-center text-xs text-muted">
            該当するフィルタがありません
          </p>
        </div>
      </template>
    </UPopover>

    <UCheckbox v-model="showCompleted" label="完了も表示" :disabled="statusFilter.length > 0" />

    <UButton
      v-if="hasActiveFilter"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      label="すべてクリア"
      @click="clearAll"
    />

    <div class="ml-auto flex items-center gap-3">
      <slot name="actions" />
      <slot name="count">
        <span class="text-sm text-muted">{{ filtered }} / {{ total }} 件</span>
      </slot>
    </div>
  </div>
</template>
