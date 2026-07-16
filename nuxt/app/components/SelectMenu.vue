<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

interface SelectItem {
  value: string;
  label: string;
}

const props = defineProps<{
  items: SelectItem[];
  current: string | null;
  allowNone?: boolean;
  defaultIcon?: string;
  noneLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** 「自分を割り当て」ショートカットの値（現在ユーザーの member id 等）。候補に含まれ、未選択のときだけ表示 */
  selfValue?: string | null;
  selfLabel?: string;
  /** true ならメニューを開かず、スロットを表示するだけ（readonly ユーザー等） */
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [value: string | null];
}>();

// 「自分を割り当て」ショートカットを出すか（selfValue が候補にあり、まだ選択中でない）
const showSelf = computed(
  () =>
    !!props.selfValue &&
    props.selfValue !== props.current &&
    props.items.some((i) => i.value === props.selfValue),
);

const menuItems = computed<DropdownMenuItem[][]>(() => {
  const main: DropdownMenuItem[] = props.items.map((item) => {
    const isCurrent = item.value === props.current;
    return {
      label: item.label,
      icon: isCurrent ? 'i-lucide-check' : (props.defaultIcon ?? undefined),
      class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
      onSelect: () => {
        if (isCurrent) return;
        emit('select', item.value);
      },
    };
  });
  const groups: DropdownMenuItem[][] = [];
  if (showSelf.value) {
    groups.push([
      {
        label: props.selfLabel ?? '自分を割り当て',
        icon: 'i-lucide-user-check',
        onSelect: () => emit('select', props.selfValue ?? null),
      },
    ]);
  }
  groups.push(main);
  if (props.allowNone) {
    const noneIsCurrent = props.current === null;
    groups.push([
      {
        label: props.noneLabel ?? 'なし',
        icon: noneIsCurrent ? 'i-lucide-check' : 'i-lucide-x',
        class: noneIsCurrent ? 'bg-elevated/80 font-semibold' : '',
        onSelect: () => {
          if (noneIsCurrent) return;
          emit('select', null);
        },
      },
    ]);
  }
  return groups;
});

// searchable モード用
const open = ref(false);
const query = ref('');

const filteredItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.items;
  return props.items.filter((i) => i.label.toLowerCase().includes(q));
});

const handleSelect = (value: string | null) => {
  emit('select', value);
  open.value = false;
};

watch(open, (v) => {
  if (!v) query.value = '';
});
</script>

<template>
  <span v-if="disabled" class="pointer-events-none">
    <slot />
  </span>
  <UPopover v-else-if="searchable" v-model:open="open">
    <slot />
    <template #content>
      <div class="flex flex-col w-64 max-h-80 p-1">
        <UInput
          v-model="query"
          :placeholder="searchPlaceholder ?? '検索…'"
          icon="i-lucide-search"
          size="sm"
          autofocus
          class="mb-1"
        />
        <button
          v-if="showSelf"
          type="button"
          class="w-full text-left text-sm px-2 py-1.5 mb-1 rounded hover:bg-elevated/60 flex items-center gap-2 text-primary"
          @click="handleSelect(selfValue ?? null)"
        >
          <UIcon name="i-lucide-user-check" class="size-4 shrink-0" />
          <span>{{ selfLabel ?? '自分を割り当て' }}</span>
        </button>
        <div class="overflow-y-auto flex-1 min-h-0">
          <button
            v-for="item in filteredItems"
            :key="item.value"
            type="button"
            class="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-elevated/60 flex items-center gap-2"
            :class="item.value === current ? 'bg-elevated/80 font-semibold' : ''"
            @click="handleSelect(item.value)"
          >
            <UIcon
              :name="item.value === current ? 'i-lucide-check' : (defaultIcon ?? 'i-lucide-circle')"
              class="size-4 shrink-0"
            />
            <span class="truncate">{{ item.label }}</span>
          </button>
          <div v-if="filteredItems.length === 0" class="text-xs text-muted px-2 py-2">該当なし</div>
        </div>
        <template v-if="allowNone">
          <USeparator class="my-1" />
          <button
            type="button"
            class="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-elevated/60 flex items-center gap-2"
            :class="current === null ? 'bg-elevated/80 font-semibold' : ''"
            @click="handleSelect(null)"
          >
            <UIcon
              :name="current === null ? 'i-lucide-check' : 'i-lucide-x'"
              class="size-4 shrink-0"
            />
            <span>{{ noneLabel ?? 'なし' }}</span>
          </button>
        </template>
      </div>
    </template>
  </UPopover>
  <UDropdownMenu v-else :items="menuItems" :ui="{ content: 'max-h-80 overflow-y-auto' }">
    <slot />
  </UDropdownMenu>
</template>
