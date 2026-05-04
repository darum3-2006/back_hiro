<script setup lang="ts">
import type { MasterColor } from '~/types/master'

export interface MasterFormPayload {
  name: string
  color: MasterColor
  isTerminal: boolean
}

const props = defineProps<{
  open: boolean
  type: 'status' | 'priority' | 'tag'
  initial: MasterFormPayload | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  submit: [MasterFormPayload]
}>()

const draft = ref<MasterFormPayload>({ name: '', color: 'neutral', isTerminal: false })

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    draft.value = props.initial
      ? { ...props.initial }
      : { name: '', color: 'neutral', isTerminal: false }
  }
)

const titleNoun = computed(
  () => ({ status: 'ステータス', priority: '優先度', tag: 'タグ' })[props.type]
)
const labelText = computed(
  () => ({ status: 'ラベル', priority: 'ラベル', tag: '名前' })[props.type]
)
const showIsTerminal = computed(() => props.type === 'status')
const isEdit = computed(() => Boolean(props.initial))
const canSubmit = computed(() => Boolean(draft.value.name.trim()))

const submit = () => {
  if (!canSubmit.value) return
  emit('submit', {
    name: draft.value.name.trim(),
    color: draft.value.color,
    isTerminal: draft.value.isTerminal
  })
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? `${titleNoun}を編集` : `新規${titleNoun}`"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField :label="labelText" required>
          <UInput v-model="draft.name" autofocus class="w-full" />
        </UFormField>
        <UFormField label="色">
          <ColorPicker v-model="draft.color" />
        </UFormField>
        <UFormField
          v-if="showIsTerminal"
          label="完了系ステータス"
          hint="完了など、対応終了を表すステータスにチェック"
        >
          <UCheckbox v-model="draft.isTerminal" label="完了として扱う" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          label="キャンセル"
          @click="emit('update:open', false)"
        />
        <UButton
          color="primary"
          :disabled="!canSubmit"
          :label="isEdit ? '保存' : '追加'"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
