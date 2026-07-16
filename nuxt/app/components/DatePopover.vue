<script setup lang="ts">
import type { DateValue } from '@internationalized/date';
import { calendarDateToIso, isoToCalendarDate } from '~/utils/date';

defineProps<{
  modelValue: string | null;
  /** true ならカレンダーを開かず、スロットを表示するだけ（readonly ユーザー等） */
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

// UCalendar の update:model-value は range / multi モードを含むため
// DateValue | DateRange | DateValue[] | null | undefined の union を要求する。
// reka-ui の DateRange は @nuxt/ui の型再エクスポートに含まれないので、
// 互換のある構造をローカルで宣言してそれにマッチさせる。
type DateRangeLike = { start: DateValue | undefined; end: DateValue | undefined };

const onCalendarUpdate = (d: DateValue | DateRangeLike | DateValue[] | null | undefined): void => {
  if (!d || Array.isArray(d) || 'start' in d) {
    emit('update:modelValue', null);
    return;
  }
  emit('update:modelValue', calendarDateToIso(d));
};
</script>

<template>
  <span v-if="disabled" class="pointer-events-none">
    <slot />
  </span>
  <UPopover v-else>
    <slot />
    <template #content>
      <div class="p-2 space-y-2">
        <UCalendar
          :model-value="isoToCalendarDate(modelValue)"
          locale="ja"
          @update:model-value="onCalendarUpdate"
        />
        <UButton
          v-if="modelValue"
          size="sm"
          color="neutral"
          variant="ghost"
          block
          label="クリア"
          @click="emit('update:modelValue', null)"
        />
      </div>
    </template>
  </UPopover>
</template>
