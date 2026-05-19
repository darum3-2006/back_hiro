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
}>();

const emit = defineEmits<{
  select: [value: string | null];
}>();

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
  if (!props.allowNone) return [main];
  const noneIsCurrent = props.current === null;
  return [
    main,
    [
      {
        label: props.noneLabel ?? 'なし',
        icon: noneIsCurrent ? 'i-lucide-check' : 'i-lucide-x',
        class: noneIsCurrent ? 'bg-elevated/80 font-semibold' : '',
        onSelect: () => {
          if (noneIsCurrent) return;
          emit('select', null);
        },
      },
    ],
  ];
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
  <UPopover v-if="searchable" v-model:open="open">
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
