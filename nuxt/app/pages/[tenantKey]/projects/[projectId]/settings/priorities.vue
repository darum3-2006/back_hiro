<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { VueDraggable } from 'vue-draggable-plus';
import {
  apiCreateTaskPriority,
  apiDeleteTaskPriority,
  apiReorderTaskPriorities,
  apiUpdateTaskPriority,
  countTaskPriorityReferences,
} from '~/api/masters';
import type { TaskPriority } from '~/types/master';
import type { MasterFormPayload } from '~/components/MasterFormModal.vue';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);

const api = useApi();
const { data: priorities, refresh: refreshPriorities } = await useTaskPriorities(projectId);

const orderedPriorities = ref<TaskPriority[]>([]);

watch(
  priorities,
  (v) => {
    orderedPriorities.value = [...v];
  },
  { immediate: true },
);

const toast = useToast();

const formModalOpen = ref(false);
const editingItem = ref<TaskPriority | null>(null);

const modalInitial = computed<MasterFormPayload | null>(() =>
  editingItem.value
    ? {
        name: editingItem.value.label,
        color: editingItem.value.color,
        isTerminal: false,
      }
    : null,
);

const openCreate = () => {
  editingItem.value = null;
  formModalOpen.value = true;
};

const openEdit = (item: TaskPriority) => {
  editingItem.value = item;
  formModalOpen.value = true;
};

const onSubmit = async (data: MasterFormPayload) => {
  if (editingItem.value) {
    await apiUpdateTaskPriority(api, projectId.value, editingItem.value.code, {
      label: data.name,
      color: data.color,
    });
  } else {
    await apiCreateTaskPriority(api, projectId.value, {
      label: data.name,
      color: data.color,
    });
    toast.add({
      title: '優先度を追加しました',
      description: data.name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  }
  await refreshPriorities();
};

const onDragEnd = async () => {
  const codes = orderedPriorities.value.map((p) => p.code);
  await apiReorderTaskPriorities(api, projectId.value, codes);
  await refreshPriorities();
};

const deleteModalOpen = ref(false);
const deleteTarget = ref<TaskPriority | null>(null);
const deleteReferences = ref<{ tasks: number } | null>(null);
const deleting = ref(false);
const loadingReferences = ref(false);

const openDelete = async (item: TaskPriority) => {
  deleteTarget.value = item;
  deleteReferences.value = null;
  deleteModalOpen.value = true;
  loadingReferences.value = true;
  try {
    deleteReferences.value = await countTaskPriorityReferences(projectId.value, item.code);
  } finally {
    loadingReferences.value = false;
  }
};

const canDelete = computed(
  () => deleteReferences.value !== null && deleteReferences.value.tasks === 0,
);

const performDelete = async () => {
  if (!deleteTarget.value || !canDelete.value) return;
  deleting.value = true;
  const name = deleteTarget.value.label;
  try {
    await apiDeleteTaskPriority(api, projectId.value, deleteTarget.value.code);
    await refreshPriorities();
    deleteModalOpen.value = false;
    toast.add({
      title: '優先度を削除しました',
      description: name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  } finally {
    deleting.value = false;
  }
};

const buildActions = (item: TaskPriority): DropdownMenuItem[][] => [
  [
    {
      label: '編集',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(item),
    },
  ],
  [
    {
      label: '削除',
      icon: 'i-lucide-trash-2',
      onSelect: () => openDelete(item),
    },
  ],
];
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex justify-between items-center">
      <p class="text-sm text-muted">{{ orderedPriorities.length }} 件 ・ ドラッグで並べ替え</p>
      <UButton color="primary" icon="i-lucide-plus" label="新規優先度" @click="openCreate" />
    </div>

    <EmptyState
      v-if="orderedPriorities.length === 0"
      icon="i-lucide-flag"
      title="優先度がまだありません"
      description="タスクの優先度（高・中・低など）を追加しましょう"
    >
      <UButton color="primary" icon="i-lucide-plus" label="新規優先度" @click="openCreate" />
    </EmptyState>

    <VueDraggable
      v-else
      v-model="orderedPriorities"
      :animation="150"
      handle=".drag-handle"
      class="space-y-1"
      @end="onDragEnd"
    >
      <div
        v-for="item in orderedPriorities"
        :key="item.code"
        class="flex items-center gap-3 px-3 py-2 rounded border border-default bg-default"
      >
        <UIcon name="i-lucide-grip-vertical" class="drag-handle cursor-move size-4 text-muted" />
        <UBadge :color="item.color" variant="subtle" :label="item.label" />
        <UDropdownMenu :items="buildActions(item)" class="ml-auto">
          <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
        </UDropdownMenu>
      </div>
    </VueDraggable>

    <MasterFormModal
      v-model:open="formModalOpen"
      type="priority"
      :initial="modalInitial"
      @submit="onSubmit"
    />

    <UModal
      v-model:open="deleteModalOpen"
      title="優先度を削除"
      :description="deleteTarget ? `「${deleteTarget.label}」を削除しますか？` : ''"
    >
      <template #body>
        <div class="space-y-2 text-sm">
          <div v-if="loadingReferences" class="text-muted">参照状況を確認中…</div>
          <div v-else-if="deleteReferences">
            <p v-if="deleteReferences.tasks === 0" class="text-success">参照なし。削除できます。</p>
            <template v-else>
              <p class="text-warning font-medium">
                この優先度は {{ deleteReferences.tasks }} 件のタスクで使用されています。
              </p>
              <p class="text-warning mt-1">タスクの優先度を変更してから削除してください。</p>
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
