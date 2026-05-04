<script setup lang="ts">
import type { MasterColor } from '~/types/master';

defineProps<{
  modelValue: MasterColor;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: MasterColor];
}>();

const colors: { value: MasterColor; label: string }[] = [
  { value: 'neutral', label: 'グレー' },
  { value: 'primary', label: 'プライマリ' },
  { value: 'info', label: 'ブルー' },
  { value: 'success', label: 'グリーン' },
  { value: 'warning', label: 'イエロー' },
  { value: 'error', label: 'レッド' }
];
</script>

<template>
  <div class="flex gap-2 flex-wrap">
    <button
      v-for="c in colors"
      :key="c.value"
      type="button"
      class="transition"
      :class="modelValue === c.value ? 'scale-105' : 'opacity-40 hover:opacity-100'"
      @click="emit('update:modelValue', c.value)"
    >
      <UBadge
        :color="c.value"
        :variant="modelValue === c.value ? 'solid' : 'soft'"
        :icon="modelValue === c.value ? 'i-lucide-check' : undefined"
        :label="c.label"
        size="lg"
      />
    </button>
  </div>
</template>
