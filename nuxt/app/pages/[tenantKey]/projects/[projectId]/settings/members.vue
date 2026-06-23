<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui';
import { apiDeleteMember, countMemberReferences } from '~/api/members';
import type { Member } from '~/types/member';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);

const api = useApi();
const { data: members, refresh: refreshMembers } = await useMembers(projectId);
const { data: users } = await useUsers();

const userMap = computed(() => Object.fromEntries(users.value.map((u) => [u.id, u])));

const { me } = useAuth();
const currentUserId = useCurrentUserId();
// メンバー管理可能か: テナント admin か、自分が当プロジェクトの ProjectMember.role=admin
const isProjectAdmin = computed(() => {
  if (me.value?.role === 'admin') return true;
  const own = members.value.find((m) => m.userId === currentUserId.value);
  return own?.role === 'admin';
});

const existingUserIds = computed(() =>
  members.value.filter((m) => m.userId !== null).map((m) => m.userId!),
);

const toast = useToast();

// ===== Add / Edit =====
const formModalOpen = ref(false);
const editingMember = ref<Member | null>(null);

const openCreate = () => {
  editingMember.value = null;
  formModalOpen.value = true;
};

const openEdit = (member: Member) => {
  editingMember.value = member;
  formModalOpen.value = true;
};

// ===== Bulk add =====（追加結果のトーストはモーダル側で表示）
const bulkModalOpen = ref(false);
const onBulkSaved = async () => {
  await refreshMembers();
};

const onSaved = async (member: Member) => {
  await refreshMembers();
  if (!editingMember.value) {
    toast.add({
      title: 'メンバーを追加しました',
      description: member.displayName,
      color: 'success',
      icon: 'i-lucide-check',
    });
  }
};

// ===== Delete =====
const deleteModalOpen = ref(false);
const deleteTarget = ref<Member | null>(null);
const deleteReferences = ref<{
  tasksAssignee: number;
  tasksRequester: number;
  comments: number;
} | null>(null);
const deleting = ref(false);
const loadingReferences = ref(false);

const openDelete = async (member: Member) => {
  deleteTarget.value = member;
  deleteReferences.value = null;
  deleteModalOpen.value = true;
  loadingReferences.value = true;
  try {
    deleteReferences.value = await countMemberReferences(api, projectId.value, member.id);
  } finally {
    loadingReferences.value = false;
  }
};

const totalRefs = computed(() => {
  const r = deleteReferences.value;
  return r ? r.tasksAssignee + r.tasksRequester + r.comments : 0;
});

const canDelete = computed(() => deleteReferences.value !== null && totalRefs.value === 0);

const performDelete = async () => {
  if (!deleteTarget.value || !canDelete.value) return;
  deleting.value = true;
  const name = deleteTarget.value.displayName;
  try {
    await apiDeleteMember(api, projectId.value, deleteTarget.value.id);
    await refreshMembers();
    deleteModalOpen.value = false;
    toast.add({
      title: 'メンバーを削除しました',
      description: name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  } finally {
    deleting.value = false;
  }
};

const buildActions = (member: Member): DropdownMenuItem[][] => [
  [
    {
      label: '編集',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(member),
    },
  ],
  [
    {
      label: '削除',
      icon: 'i-lucide-trash-2',
      onSelect: () => openDelete(member),
    },
  ],
];

const columns: TableColumn<Member>[] = [
  { accessorKey: 'displayName', header: '名前' },
  { accessorKey: 'userId', header: 'User紐付け' },
  { accessorKey: 'role', header: '権限' },
  { id: 'actions', header: '' },
];
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex justify-between items-center">
      <p class="text-sm text-muted">メンバー {{ members.length }} 人</p>
      <div v-if="isProjectAdmin" class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-list-plus"
          label="一括追加"
          @click="bulkModalOpen = true"
        />
        <UButton color="primary" icon="i-lucide-plus" label="メンバーを追加" @click="openCreate" />
      </div>
    </div>

    <EmptyState
      v-if="members.length === 0"
      icon="i-lucide-users"
      title="メンバーがまだいません"
      :description="
        isProjectAdmin
          ? 'メンバーを追加するとタスクを担当者に割り当てられます'
          : 'メンバーの追加はプロジェクト管理者にお問い合わせください'
      "
    >
      <UButton
        v-if="isProjectAdmin"
        color="primary"
        icon="i-lucide-plus"
        label="メンバーを追加"
        @click="openCreate"
      />
    </EmptyState>

    <UTable v-else :data="members" :columns="columns" :ui="{ td: 'py-2' }">
      <template #displayName-cell="{ row }">
        <span class="font-medium">{{ row.original.displayName }}</span>
      </template>
      <template #userId-cell="{ row }">
        <span v-if="row.original.userId" class="text-sm">
          {{ userMap[row.original.userId]?.name ?? row.original.userId }}
          <span class="text-muted"> ({{ userMap[row.original.userId]?.email }})</span>
        </span>
        <UBadge v-else color="neutral" variant="soft" size="sm" label="未紐付け" />
      </template>
      <template #role-cell="{ row }">
        <UBadge
          :color="row.original.role === 'admin' ? 'primary' : 'neutral'"
          variant="soft"
          size="sm"
          :label="row.original.role === 'admin' ? 'Admin' : 'Member'"
        />
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end">
          <UDropdownMenu v-if="isProjectAdmin" :items="buildActions(row.original)">
            <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
          </UDropdownMenu>
        </div>
      </template>
    </UTable>

    <MemberFormModal
      v-model:open="formModalOpen"
      :project-id="projectId"
      :member="editingMember"
      :users="users"
      :existing-user-ids="existingUserIds"
      @saved="onSaved"
    />

    <MemberBulkModal v-model:open="bulkModalOpen" :project-id="projectId" @saved="onBulkSaved" />

    <AppModal
      v-model:open="deleteModalOpen"
      title="メンバーを削除"
      :description="deleteTarget ? `「${deleteTarget.displayName}」を削除しますか？` : ''"
    >
      <template #body>
        <div class="space-y-2 text-sm">
          <div v-if="loadingReferences" class="text-muted">参照状況を確認中…</div>
          <div v-else-if="deleteReferences">
            <p v-if="totalRefs === 0" class="text-success">参照なし。削除できます。</p>
            <template v-else>
              <p class="text-warning font-medium">このメンバーは以下から参照されています:</p>
              <ul class="list-disc pl-6 text-muted mt-1 space-y-0.5">
                <li v-if="deleteReferences.tasksAssignee">
                  担当者: {{ deleteReferences.tasksAssignee }} 件のタスク
                </li>
                <li v-if="deleteReferences.tasksRequester">
                  依頼者: {{ deleteReferences.tasksRequester }} 件のタスク
                </li>
                <li v-if="deleteReferences.comments">
                  コメント投稿: {{ deleteReferences.comments }} 件
                </li>
              </ul>
              <p class="text-warning mt-2">参照を解消してから削除してください。</p>
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
