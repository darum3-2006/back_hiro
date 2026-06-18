<script setup lang="ts">
import type { TaskFilters } from '~/composables/useTaskFilters';

const props = defineProps<{
  filters: TaskFilters;
  /** 全件数 / 絞り込み後件数（右端の表示用） */
  total: number;
  filtered: number;
}>();

// 値はすべて ref / computed / 関数 / 安定配列なので、分割代入してもリアクティブは保たれる。
const {
  search,
  statusFilter,
  priorityFilter,
  assigneeFilter,
  tagFilter,
  flagFilter,
  showCompleted,
  hasActiveFilter,
  hasActiveDateFilter,
  resetFilters,
  statusSelectItems,
  prioritySelectItems,
  assigneeFilterItems,
  tagFilterItems,
  flagFilterItems,
  dateFilterChips,
  dateRangeFilterDefs,
} = props.filters;

// 日付ポップオーバーは一度に 1 種類だけカレンダーを開く（全部開くと巨大になるため）
const expandedDateKey = ref<string | null>(null);
const toggleDate = (key: string) => {
  expandedDateKey.value = expandedDateKey.value === key ? null : key;
};
</script>

<template>
  <div class="flex flex-col">
    <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-default">
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
      <div class="flex items-center gap-1">
        <USelectMenu
          v-model="statusFilter"
          :items="statusSelectItems"
          value-key="value"
          multiple
          placeholder="すべてのステータス"
          class="w-44"
        />
        <UButton
          v-if="statusFilter.length > 0"
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="ステータスフィルタをクリア"
          @click="statusFilter = []"
        />
      </div>
      <div class="flex items-center gap-1">
        <USelectMenu
          v-model="priorityFilter"
          :items="prioritySelectItems"
          value-key="value"
          multiple
          placeholder="すべての優先度"
          class="w-40"
        />
        <UButton
          v-if="priorityFilter.length > 0"
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="優先度フィルタをクリア"
          @click="priorityFilter = []"
        />
      </div>
      <div class="flex items-center gap-1">
        <USelectMenu
          v-model="assigneeFilter"
          :items="assigneeFilterItems"
          value-key="value"
          multiple
          placeholder="すべての担当者"
          icon="i-lucide-user"
          searchable
          search-placeholder="名前で検索…"
          class="w-44"
        />
        <UButton
          v-if="assigneeFilter.length > 0"
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="担当者フィルタをクリア"
          @click="assigneeFilter = []"
        />
      </div>
      <div class="flex items-center gap-1">
        <USelectMenu
          v-model="tagFilter"
          :items="tagFilterItems"
          value-key="value"
          multiple
          placeholder="すべてのタグ"
          icon="i-lucide-tag"
          searchable
          search-placeholder="タグ名で検索…"
          class="w-44"
        />
        <UButton
          v-if="tagFilter.length > 0"
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="タグフィルタをクリア"
          @click="tagFilter = []"
        />
      </div>
      <div class="flex items-center gap-1">
        <USelectMenu
          v-model="flagFilter"
          :items="flagFilterItems"
          value-key="value"
          multiple
          placeholder="すべてのフラグ"
          icon="i-lucide-bookmark"
          searchable
          search-placeholder="フラグ名で検索…"
          class="w-44"
        />
        <UButton
          v-if="flagFilter.length > 0"
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="フラグフィルタをクリア"
          @click="flagFilter = []"
        />
      </div>
      <UPopover :ui="{ content: 'p-2 w-auto max-h-[75vh] overflow-y-auto' }">
        <UButton
          color="neutral"
          :variant="hasActiveDateFilter ? 'soft' : 'outline'"
          icon="i-lucide-calendar-range"
          label="日付"
          trailing-icon="i-lucide-chevron-down"
        />
        <template #content>
          <div class="min-w-56">
            <!-- 一度に開くのは 1 種類だけ（アコーディオン）。全部開くと巨大化するため -->
            <div v-for="def in dateRangeFilterDefs" :key="def.key">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-elevated/50"
                @click="toggleDate(def.key)"
              >
                <span :class="def.filter.isActive.value ? 'font-medium text-primary' : ''">
                  {{ def.label }}
                </span>
                <span class="flex items-center gap-1">
                  <span v-if="def.filter.isActive.value" class="size-1.5 rounded-full bg-primary" />
                  <UIcon
                    :name="
                      expandedDateKey === def.key
                        ? 'i-lucide-chevron-down'
                        : 'i-lucide-chevron-right'
                    "
                    class="size-4 text-muted"
                  />
                </span>
              </button>
              <DateRangeFilter
                v-if="expandedDateKey === def.key"
                :model-value="def.filter.range.value"
                @update:model-value="(v) => (def.filter.range.value = v)"
              />
            </div>
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
        @click="resetFilters"
      />
      <span class="ml-auto text-sm text-muted">{{ filtered }} / {{ total }} 件</span>
    </div>

    <div
      v-if="hasActiveDateFilter"
      class="flex flex-wrap items-center gap-2 px-4 pb-2 border-b border-default"
    >
      <span class="text-xs text-muted">フィルタ:</span>
      <div
        v-for="chip in dateFilterChips"
        :key="chip.label"
        class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-primary/10 text-primary text-xs"
      >
        <span>{{ chip.label }}: {{ chip.text }}</span>
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="primary"
          variant="ghost"
          :aria-label="`${chip.label}フィルタをクリア`"
          @click="chip.clear"
        />
      </div>
    </div>
  </div>
</template>
