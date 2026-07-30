<script setup lang="ts">
import type { MasterColor } from '~/types/master';

defineProps<{
  modelValue: MasterColor;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: MasterColor];
}>();

// primary/secondary はテナント既定色のエイリアス（green/blue と被る）ため選択肢からは外す
const colors: { value: MasterColor; label: string }[] = [
  { value: 'neutral', label: 'グレー' },
  { value: 'info', label: 'ブルー' },
  { value: 'success', label: 'グリーン' },
  { value: 'warning', label: 'イエロー' },
  { value: 'error', label: 'レッド' },
  { value: 'rose', label: 'ローズ' },
  { value: 'sky', label: 'スカイ' },
  { value: 'cyan', label: 'シアン' },
  { value: 'amber', label: 'アンバー' },
  { value: 'olive', label: 'オリーブ' },
  { value: 'emerald', label: 'エメラルド' },
  { value: 'indigo', label: 'インディゴ' },
  { value: 'violet', label: 'バイオレット' },
  { value: 'fuchsia', label: 'フューシャ' },
  { value: 'mauve', label: 'モーブ' },
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
