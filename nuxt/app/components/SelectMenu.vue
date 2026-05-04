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
      }
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
        }
      }
    ]
  ];
});
</script>

<template>
  <UDropdownMenu :items="menuItems">
    <slot />
  </UDropdownMenu>
</template>
