<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { calendarDateToIso, isoToCalendarDate } from '~/utils/date'

defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()
</script>

<template>
  <UPopover>
    <slot />
    <template #content>
      <div class="p-2 space-y-2">
        <UCalendar
          :model-value="isoToCalendarDate(modelValue)"
          locale="ja"
          @update:model-value="
            (d: DateValue | null) => emit('update:modelValue', calendarDateToIso(d))
          "
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
