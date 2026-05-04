<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui'
import { countTagReferences, createTag, deleteTag, updateTag } from '~/api/masters'
import type { Tag } from '~/types/master'
import type { MasterFormPayload } from '~/components/MasterFormModal.vue'

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const { data: tags, refresh: refreshTags } = await useTags(projectId)

const toast = useToast()

const formModalOpen = ref(false)
const editingItem = ref<Tag | null>(null)

const modalInitial = computed<MasterFormPayload | null>(() =>
  editingItem.value
    ? {
        name: editingItem.value.name,
        color: editingItem.value.color,
        isTerminal: false
      }
    : null
)

const openCreate = () => {
  editingItem.value = null
  formModalOpen.value = true
}

const openEdit = (item: Tag) => {
  editingItem.value = item
  formModalOpen.value = true
}

const onSubmit = async (data: MasterFormPayload) => {
  if (editingItem.value) {
    await updateTag(projectId.value, editingItem.value.code, {
      name: data.name,
      color: data.color
    })
  } else {
    await createTag(projectId.value, {
      name: data.name,
      color: data.color
    })
    toast.add({
      title: 'タグを追加しました',
      description: data.name,
      color: 'success',
      icon: 'i-lucide-check'
    })
  }
  await refreshTags()
}

const deleteModalOpen = ref(false)
const deleteTarget = ref<Tag | null>(null)
const deleteReferences = ref<{ tasks: number } | null>(null)
const deleting = ref(false)
const loadingReferences = ref(false)

const openDelete = async (item: Tag) => {
  deleteTarget.value = item
  deleteReferences.value = null
  deleteModalOpen.value = true
  loadingReferences.value = true
  try {
    deleteReferences.value = await countTagReferences(projectId.value, item.code)
  } finally {
    loadingReferences.value = false
  }
}

const canDelete = computed(
  () => deleteReferences.value !== null && deleteReferences.value.tasks === 0
)

const performDelete = async () => {
  if (!deleteTarget.value || !canDelete.value) return
  deleting.value = true
  const name = deleteTarget.value.name
  try {
    await deleteTag(projectId.value, deleteTarget.value.code)
    await refreshTags()
    deleteModalOpen.value = false
    toast.add({
      title: 'タグを削除しました',
      description: name,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } finally {
    deleting.value = false
  }
}

const buildActions = (item: Tag): DropdownMenuItem[][] => [
  [
    {
      label: '編集',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(item)
    }
  ],
  [
    {
      label: '削除',
      icon: 'i-lucide-trash-2',
      onSelect: () => openDelete(item)
    }
  ]
]

const columns: TableColumn<Tag>[] = [
  { accessorKey: 'name', header: '名前' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex justify-between items-center">
      <p class="text-sm text-muted">{{ tags.length }} 件</p>
      <UButton color="primary" icon="i-lucide-plus" label="新規タグ" @click="openCreate" />
    </div>

    <UTable :data="tags" :columns="columns" :ui="{ td: 'py-2' }">
      <template #name-cell="{ row }">
        <UBadge :color="row.original.color" variant="soft" :label="row.original.name" />
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end">
          <UDropdownMenu :items="buildActions(row.original)">
            <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
          </UDropdownMenu>
        </div>
      </template>
    </UTable>

    <MasterFormModal
      v-model:open="formModalOpen"
      type="tag"
      :initial="modalInitial"
      @submit="onSubmit"
    />

    <UModal
      v-model:open="deleteModalOpen"
      title="タグを削除"
      :description="deleteTarget ? `「${deleteTarget.name}」を削除しますか？` : ''"
    >
      <template #body>
        <div class="space-y-2 text-sm">
          <div v-if="loadingReferences" class="text-muted">参照状況を確認中…</div>
          <div v-else-if="deleteReferences">
            <p v-if="deleteReferences.tasks === 0" class="text-success">参照なし。削除できます。</p>
            <template v-else>
              <p class="text-warning font-medium">
                このタグは {{ deleteReferences.tasks }} 件のタスクで使用されています。
              </p>
              <p class="text-warning mt-1">タスクのタグを外してから削除してください。</p>
            </template>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="キャンセル"
            @click="deleteModalOpen = false"
          />
          <UButton
            color="error"
            :loading="deleting"
            :disabled="!canDelete"
            icon="i-lucide-trash-2"
            label="削除"
            @click="performDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
