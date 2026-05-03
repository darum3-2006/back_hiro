<script setup lang="ts">
import type { Tag } from '~/types/master'

const props = defineProps<{
  tags: Tag[]
  selected: string[]
}>()

const emit = defineEmits<{
  'update:selected': [codes: string[]]
}>()

const toggleTag = (code: string, enabled: boolean) => {
  const next = enabled
    ? [...props.selected, code]
    : props.selected.filter(c => c !== code)
  emit('update:selected', next)
}
</script>

<template>
  <UPopover>
    <slot />
    <template #content>
      <div class="p-2 space-y-1 min-w-48">
        <label
          v-for="t in tags"
          :key="t.code"
          class="flex items-center gap-2 px-2 py-1 hover:bg-elevated/40 rounded cursor-pointer"
        >
          <UCheckbox
            :model-value="selected.includes(t.code)"
            @update:model-value="(v: boolean) => toggleTag(t.code, v)"
          />
          <UBadge :color="t.color" variant="soft" size="sm" :label="t.name" />
        </label>
      </div>
    </template>
  </UPopover>
</template>
