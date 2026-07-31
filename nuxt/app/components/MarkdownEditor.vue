<script setup lang="ts">
import type { Task } from '~/types/task';

interface MentionCandidate {
  id: string;
  name: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    /** #seq 内部リンク解決用（プレビュー） */
    tasks?: Task[];
    /** @メンション候補（指定すると編集欄が @ オートコンプリート対応に） */
    candidates?: MentionCandidate[];
    /** @メンション強調名（プレビュー） */
    mentionNames?: string[];
    showImages?: boolean;
    rows?: number;
    placeholder?: string;
    disabled?: boolean;
    /** マウント時に編集欄へフォーカスする（編集モード開始で表示されるケース用） */
    autofocus?: boolean;
  }>(),
  {
    tasks: () => [],
    candidates: () => [],
    mentionNames: () => [],
    showImages: false,
    rows: 3,
    placeholder: '',
    disabled: false,
    autofocus: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [string];
  submit: [];
}>();

const tab = ref<'edit' | 'preview'>('edit');
const hasContent = computed(() => props.modelValue.trim().length > 0);
</script>

<template>
  <div>
    <div class="mb-1 flex items-center gap-1">
      <UButton
        size="xs"
        :variant="tab === 'edit' ? 'soft' : 'ghost'"
        :color="tab === 'edit' ? 'primary' : 'neutral'"
        label="編集"
        @click="tab = 'edit'"
      />
      <UButton
        size="xs"
        :variant="tab === 'preview' ? 'soft' : 'ghost'"
        :color="tab === 'preview' ? 'primary' : 'neutral'"
        icon="i-lucide-eye"
        label="プレビュー"
        @click="tab = 'preview'"
      />
    </div>

    <MentionTextarea
      v-show="tab === 'edit'"
      :model-value="modelValue"
      :candidates="candidates"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :autofocus="autofocus"
      @update:model-value="(v: string) => emit('update:modelValue', v)"
      @submit="emit('submit')"
    />

    <div
      v-if="tab === 'preview'"
      class="rounded-md border border-default px-2.5 py-1.5"
      :style="{ minHeight: `${(rows ?? 3) * 1.5 + 0.75}rem` }"
    >
      <MarkdownContent
        v-if="hasContent"
        :text="modelValue"
        :tasks="tasks"
        :mention-names="mentionNames"
        :show-images="showImages"
      />
      <span v-else class="text-sm text-muted">プレビューする内容がありません</span>
    </div>
  </div>
</template>
