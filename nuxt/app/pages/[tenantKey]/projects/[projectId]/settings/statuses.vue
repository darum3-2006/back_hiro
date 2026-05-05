<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { VueDraggable } from 'vue-draggable-plus';
import {
  apiCreateTaskStatus,
  apiDeleteTaskStatus,
  apiReorderTaskStatuses,
  apiUpdateTaskStatus,
  countTaskStatusReferences,
} from '~/api/masters';
import type { TaskStatus } from '~/types/master';
import type { MasterFormPayload } from '~/components/MasterFormModal.vue';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);

const api = useApi();
const { data: statuses, refresh: refreshStatuses } = await useTaskStatuses(projectId);

const orderedStatuses = ref<TaskStatus[]>([]);

watch(
  statuses,
  (v) => {
    orderedStatuses.value = [...v];
  },
  { immediate: true },
);

const toast = useToast();

// ===== Add / Edit =====
const formModalOpen = ref(false);
const editingItem = ref<TaskStatus | null>(null);

const modalInitial = computed<MasterFormPayload | null>(() =>
  editingItem.value
    ? {
        name: editingItem.value.label,
        color: editingItem.value.color,
        isTerminal: editingItem.value.isTerminal,
      }
    : null,
);

const openCreate = () => {
  editingItem.value = null;
  formModalOpen.value = true;
};

const openEdit = (item: TaskStatus) => {
  editingItem.value = item;
  formModalOpen.value = true;
};

const onSubmit = async (data: MasterFormPayload) => {
  if (editingItem.value) {
    await apiUpdateTaskStatus(api, projectId.value, editingItem.value.code, {
      label: data.name,
      color: data.color,
      isTerminal: data.isTerminal,
    });
  } else {
    await apiCreateTaskStatus(api, projectId.value, {
      label: data.name,
      color: data.color,
      isTerminal: data.isTerminal,
    });
    toast.add({
      title: 'ステータスを追加しました',
      description: data.name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  }
  await refreshStatuses();
};

// ===== Drag & Drop reorder =====
const onDragEnd = async () => {
  const codes = orderedStatuses.value.map((s) => s.code);
  await apiReorderTaskStatuses(api, projectId.value, codes);
  await refreshStatuses();
};

// ===== Delete =====
const deleteModalOpen = ref(false);
const deleteTarget = ref<TaskStatus | null>(null);
const deleteReferences = ref<{ tasks: number } | null>(null);
const deleting = ref(false);
const loadingReferences = ref(false);

const openDelete = async (item: TaskStatus) => {
  deleteTarget.value = item;
  deleteReferences.value = null;
  deleteModalOpen.value = true;
  loadingReferences.value = true;
  try {
    deleteReferences.value = await countTaskStatusReferences(api, projectId.value, item.code);
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
    await apiDeleteTaskStatus(api, projectId.value, deleteTarget.value.code);
    await refreshStatuses();
    deleteModalOpen.value = false;
    toast.add({
      title: 'ステータスを削除しました',
      description: name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  } finally {
    deleting.value = false;
  }
};

const buildActions = (item: TaskStatus): DropdownMenuItem[][] => [
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
      <p class="text-sm text-muted">{{ orderedStatuses.length }} 件 ・ ドラッグで並べ替え</p>
      <UButton color="primary" icon="i-lucide-plus" label="新規ステータス" @click="openCreate" />
    </div>

    <EmptyState
      v-if="orderedStatuses.length === 0"
      icon="i-lucide-circle-dashed"
      title="ステータスがまだありません"
      description="タスクの状態（未着手・対応中・完了など）を表すステータスを追加しましょう"
    >
      <UButton color="primary" icon="i-lucide-plus" label="新規ステータス" @click="openCreate" />
    </EmptyState>

    <VueDraggable
      v-else
      v-model="orderedStatuses"
      :animation="150"
      handle=".drag-handle"
      class="space-y-1"
      @end="onDragEnd"
    >
      <div
        v-for="item in orderedStatuses"
        :key="item.code"
        class="flex items-center gap-3 px-3 py-2 rounded border border-default bg-default"
      >
        <UIcon name="i-lucide-grip-vertical" class="drag-handle cursor-move size-4 text-muted" />
        <UBadge :color="item.color" variant="subtle" :label="item.label" />
        <span v-if="item.isTerminal" class="text-xs text-success flex items-center gap-1">
          <UIcon name="i-lucide-check-circle" class="size-3" />
          完了系
        </span>
        <UDropdownMenu :items="buildActions(item)" class="ml-auto">
          <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
        </UDropdownMenu>
      </div>
    </VueDraggable>

    <MasterFormModal
      v-model:open="formModalOpen"
      type="status"
      :initial="modalInitial"
      @submit="onSubmit"
    />

    <UModal
      v-model:open="deleteModalOpen"
      title="ステータスを削除"
      :description="deleteTarget ? `「${deleteTarget.label}」を削除しますか？` : ''"
    >
      <template #body>
        <div class="space-y-2 text-sm">
          <div v-if="loadingReferences" class="text-muted">参照状況を確認中…</div>
          <div v-else-if="deleteReferences">
            <p v-if="deleteReferences.tasks === 0" class="text-success">参照なし。削除できます。</p>
            <template v-else>
              <p class="text-warning font-medium">
                このステータスは {{ deleteReferences.tasks }} 件のタスクで使用されています。
              </p>
              <p class="text-warning mt-1">タスクのステータスを変更してから削除してください。</p>
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
