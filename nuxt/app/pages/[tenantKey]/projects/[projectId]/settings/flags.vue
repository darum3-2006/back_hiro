<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui';
import {
  apiCopyFlag,
  apiCreateFlag,
  apiDeleteFlag,
  apiDetachFlagFromAllTasks,
  apiMoveFlag,
  apiUpdateFlag,
  countFlagReferences,
} from '~/api/masters';
import type { Flag } from '~/types/master';
import type { MasterFormPayload } from '~/components/MasterFormModal.vue';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);

const api = useApi();
const { data: flags, refresh: refreshFlags } = await useFlags(projectId);

const toast = useToast();

const formModalOpen = ref(false);
const editingItem = ref<Flag | null>(null);

const modalInitial = computed<MasterFormPayload | null>(() =>
  editingItem.value
    ? {
        name: editingItem.value.name,
        color: editingItem.value.color,
        isTerminal: false,
      }
    : null,
);

const openCreate = () => {
  editingItem.value = null;
  formModalOpen.value = true;
};

const openEdit = (item: Flag) => {
  editingItem.value = item;
  formModalOpen.value = true;
};

const onSubmit = async (data: MasterFormPayload) => {
  if (editingItem.value) {
    await apiUpdateFlag(api, projectId.value, editingItem.value.code, {
      name: data.name,
      color: data.color,
    });
  } else {
    await apiCreateFlag(api, projectId.value, {
      name: data.name,
      color: data.color,
    });
    toast.add({
      title: 'フラグを追加しました',
      description: data.name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  }
  await refreshFlags();
};

// ===== 全タスクから外す =====
const detachModalOpen = ref(false);
const detachTarget = ref<Flag | null>(null);
const detachReferences = ref<{ tasks: number } | null>(null);
const detaching = ref(false);
const loadingDetachReferences = ref(false);

const openDetach = async (item: Flag) => {
  detachTarget.value = item;
  detachReferences.value = null;
  detachModalOpen.value = true;
  loadingDetachReferences.value = true;
  try {
    detachReferences.value = await countFlagReferences(api, projectId.value, item.code);
  } finally {
    loadingDetachReferences.value = false;
  }
};

const performDetach = async () => {
  if (!detachTarget.value) return;
  detaching.value = true;
  const name = detachTarget.value.name;
  try {
    await apiDetachFlagFromAllTasks(api, projectId.value, detachTarget.value.code);
    detachModalOpen.value = false;
    toast.add({
      title: 'フラグを全タスクから外しました',
      description: name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  } finally {
    detaching.value = false;
  }
};

// ===== コピー / 移動 =====
const opModalOpen = ref(false);
const opMode = ref<'copy' | 'move'>('copy');
const opSource = ref<Flag | null>(null);
const opTargetCode = ref<string | undefined>(undefined);
const opReferences = ref<{ tasks: number } | null>(null);
const loadingOpReferences = ref(false);
const opRunning = ref(false);

const opNoun = computed(() => (opMode.value === 'copy' ? 'コピー' : '移動'));

// 移動/コピー先候補（自分自身は除く）
const opTargetItems = computed(() =>
  flags.value
    .filter((f) => f.code !== opSource.value?.code)
    .map((f) => ({ label: f.name, value: f.code })),
);

const openOp = async (mode: 'copy' | 'move', item: Flag) => {
  opMode.value = mode;
  opSource.value = item;
  opTargetCode.value = undefined;
  opReferences.value = null;
  opModalOpen.value = true;
  loadingOpReferences.value = true;
  try {
    opReferences.value = await countFlagReferences(api, projectId.value, item.code);
  } finally {
    loadingOpReferences.value = false;
  }
};

const performOp = async () => {
  if (!opSource.value || !opTargetCode.value) return;
  opRunning.value = true;
  const sourceName = opSource.value.name;
  const targetName = flags.value.find((f) => f.code === opTargetCode.value)?.name ?? '';
  try {
    if (opMode.value === 'copy') {
      await apiCopyFlag(api, projectId.value, opSource.value.code, opTargetCode.value);
    } else {
      await apiMoveFlag(api, projectId.value, opSource.value.code, opTargetCode.value);
    }
    opModalOpen.value = false;
    toast.add({
      title: opMode.value === 'copy' ? 'フラグをコピーしました' : 'フラグを移動しました',
      description: `${sourceName} → ${targetName}`,
      color: 'success',
      icon: 'i-lucide-check',
    });
  } finally {
    opRunning.value = false;
  }
};

// ===== 削除 =====
const deleteModalOpen = ref(false);
const deleteTarget = ref<Flag | null>(null);
const deleteReferences = ref<{ tasks: number } | null>(null);
const deleting = ref(false);
const loadingReferences = ref(false);

const openDelete = async (item: Flag) => {
  deleteTarget.value = item;
  deleteReferences.value = null;
  deleteModalOpen.value = true;
  loadingReferences.value = true;
  try {
    deleteReferences.value = await countFlagReferences(api, projectId.value, item.code);
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
  const name = deleteTarget.value.name;
  try {
    await apiDeleteFlag(api, projectId.value, deleteTarget.value.code);
    await refreshFlags();
    deleteModalOpen.value = false;
    toast.add({
      title: 'フラグを削除しました',
      description: name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  } finally {
    deleting.value = false;
  }
};

const buildActions = (item: Flag): DropdownMenuItem[][] => [
  [
    {
      label: '編集',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(item),
    },
    {
      label: 'コピー（別フラグを追加）',
      icon: 'i-lucide-copy-plus',
      onSelect: () => openOp('copy', item),
    },
    {
      label: '移動（別フラグへ付け替え）',
      icon: 'i-lucide-arrow-right-left',
      onSelect: () => openOp('move', item),
    },
    {
      label: '全タスクから外す',
      icon: 'i-lucide-eraser',
      onSelect: () => openDetach(item),
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

const columns: TableColumn<Flag>[] = [
  { accessorKey: 'name', header: '名前' },
  { id: 'actions', header: '' },
];
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex justify-between items-center">
      <p class="text-sm text-muted">{{ flags.length }} 件</p>
      <UButton color="primary" icon="i-lucide-plus" label="新規フラグ" @click="openCreate" />
    </div>

    <EmptyState
      v-if="flags.length === 0"
      icon="i-lucide-bookmark"
      title="フラグがまだありません"
      description="タスクを任意の軸で括るフラグ（今スプリント・要確認など）を追加しましょう"
    >
      <UButton color="primary" icon="i-lucide-plus" label="新規フラグ" @click="openCreate" />
    </EmptyState>

    <UTable v-else :data="flags" :columns="columns" :ui="{ td: 'py-2' }">
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
      type="flag"
      :initial="modalInitial"
      @submit="onSubmit"
    />

    <AppModal
      v-model:open="opModalOpen"
      :title="opSource ? `フラグを${opNoun}` : ''"
      :description="
        opSource
          ? opMode === 'copy'
            ? `「${opSource.name}」が付いたタスクに、別のフラグを追加します（「${opSource.name}」は残ります）。`
            : `「${opSource.name}」が付いたタスクで、「${opSource.name}」を外して別のフラグを付与します。`
          : ''
      "
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <p v-if="loadingOpReferences" class="text-muted">対象を確認中…</p>
          <p v-else-if="opReferences" class="text-muted">対象タスク: {{ opReferences.tasks }} 件</p>
          <div>
            <p class="text-xs text-muted mb-1">{{ opNoun }}先フラグ</p>
            <USelectMenu
              v-model="opTargetCode"
              :items="opTargetItems"
              value-key="value"
              placeholder="フラグを選択…"
              searchable
              search-placeholder="フラグ名で検索…"
              class="w-full"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="キャンセル"
            @click="opModalOpen = false"
          />
          <UButton
            color="primary"
            :loading="opRunning"
            :disabled="!opTargetCode || (opReferences?.tasks ?? 0) === 0"
            :icon="opMode === 'copy' ? 'i-lucide-copy-plus' : 'i-lucide-arrow-right-left'"
            :label="opNoun"
            @click="performOp"
          />
        </div>
      </template>
    </AppModal>

    <AppModal
      v-model:open="detachModalOpen"
      title="フラグを全タスクから外す"
      :description="detachTarget ? `「${detachTarget.name}」を全タスクから外しますか？` : ''"
    >
      <template #body>
        <div class="space-y-2 text-sm">
          <div v-if="loadingDetachReferences" class="text-muted">対象を確認中…</div>
          <div v-else-if="detachReferences">
            <p v-if="detachReferences.tasks === 0" class="text-muted">
              現在このフラグが付いたタスクはありません。
            </p>
            <p v-else>
              このフラグは
              {{ detachReferences.tasks }}
              件のタスクに付いています。すべてから外します（フラグ定義は残ります）。
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="キャンセル"
            @click="detachModalOpen = false"
          />
          <UButton
            color="warning"
            :loading="detaching"
            :disabled="!detachReferences || detachReferences.tasks === 0"
            icon="i-lucide-eraser"
            label="全タスクから外す"
            @click="performDetach"
          />
        </div>
      </template>
    </AppModal>

    <AppModal
      v-model:open="deleteModalOpen"
      title="フラグを削除"
      :description="deleteTarget ? `「${deleteTarget.name}」を削除しますか？` : ''"
    >
      <template #body>
        <div class="space-y-2 text-sm">
          <div v-if="loadingReferences" class="text-muted">参照状況を確認中…</div>
          <div v-else-if="deleteReferences">
            <p v-if="deleteReferences.tasks === 0" class="text-success">参照なし。削除できます。</p>
            <template v-else>
              <p class="text-warning font-medium">
                このフラグは {{ deleteReferences.tasks }} 件のタスクで使用されています。
              </p>
              <p class="text-warning mt-1">「全タスクから外す」を実行してから削除してください。</p>
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
    </AppModal>
  </div>
</template>
