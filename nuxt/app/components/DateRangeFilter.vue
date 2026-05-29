<script setup lang="ts">
import type { DateValue } from '@internationalized/date';
import { calendarDateToIso, isoToCalendarDate } from '~/utils/date';

export type DateRangeValue = { from: string | null; to: string | null };

const props = defineProps<{ modelValue: DateRangeValue }>();
const emit = defineEmits<{ 'update:modelValue': [DateRangeValue] }>();

// UCalendar の update:model-value は range/multi モードを含むので union を要求する。
// ここではシングル日付のみ扱う想定なので、それ以外は null として扱う。
type DateRangeLike = { start: DateValue | undefined; end: DateValue | undefined };

const onCalendarUpdate = (
  field: 'from' | 'to',
  d: DateValue | DateRangeLike | DateValue[] | null | undefined,
): void => {
  if (!d || Array.isArray(d) || 'start' in d) {
    emit('update:modelValue', { ...props.modelValue, [field]: null });
    return;
  }
  emit('update:modelValue', { ...props.modelValue, [field]: calendarDateToIso(d) });
};

const hasValue = computed(() => Boolean(props.modelValue.from || props.modelValue.to));
const clear = () => emit('update:modelValue', { from: null, to: null });
</script>

<template>
  <div class="p-2 space-y-2">
    <div class="flex flex-col gap-3 sm:flex-row sm:gap-3">
      <div class="space-y-1">
        <p class="text-xs text-muted">開始日</p>
        <UCalendar
          :model-value="isoToCalendarDate(modelValue.from)"
          locale="ja"
          @update:model-value="(d) => onCalendarUpdate('from', d)"
        />
      </div>
      <div class="space-y-1">
        <p class="text-xs text-muted">終了日</p>
        <UCalendar
          :model-value="isoToCalendarDate(modelValue.to)"
          locale="ja"
          @update:model-value="(d) => onCalendarUpdate('to', d)"
        />
      </div>
    </div>
    <UButton
      v-if="hasValue"
      size="sm"
      color="neutral"
      variant="ghost"
      block
      label="クリア"
      @click="clear"
    />
  </div>
</template>
