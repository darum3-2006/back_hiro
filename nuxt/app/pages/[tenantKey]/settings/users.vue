<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui';
import { apiDeleteUser } from '~/api/users';
import type { User } from '~/types/master';

const { me } = useAuth();
const api = useApi();
const toast = useToast();

// admin 以外がアクセスしたらテナントトップへ送り返す
if (me.value && me.value.role !== 'admin') {
  await navigateTo(`/${me.value.tenant.key}`, { replace: true });
}

const { data: users, refresh: refreshUsers } = await useUsers();

// ===== Add / Edit =====
const formModalOpen = ref(false);
const editingUser = ref<User | null>(null);

const openCreate = () => {
  editingUser.value = null;
  formModalOpen.value = true;
};

const openEdit = (user: User) => {
  editingUser.value = user;
  formModalOpen.value = true;
};

const onSaved = async (saved: User) => {
  await refreshUsers();
  toast.add({
    title: editingUser.value ? 'ユーザーを更新しました' : 'ユーザーを追加しました',
    description: `${saved.name} (${saved.email})`,
    color: 'success',
    icon: 'i-lucide-check',
  });
};

// ===== Delete =====
const deleteModalOpen = ref(false);
const deleteTarget = ref<User | null>(null);
const deleting = ref(false);

const openDelete = (user: User) => {
  deleteTarget.value = user;
  deleteModalOpen.value = true;
};

const performDelete = async () => {
  if (!deleteTarget.value) return;
  deleting.value = true;
  const name = deleteTarget.value.name;
  try {
    await apiDeleteUser(api, deleteTarget.value.id);
    await refreshUsers();
    deleteModalOpen.value = false;
    toast.add({
      title: 'ユーザーを削除しました',
      description: name,
      color: 'success',
      icon: 'i-lucide-check',
    });
  } catch (e: unknown) {
    const data =
      typeof e === 'object' && e !== null && 'data' in e
        ? ((e as { data?: { message?: string | string[] } }).data ?? {})
        : {};
    const msg = Array.isArray(data.message)
      ? data.message.join(', ')
      : (data.message ?? 'ユーザーの削除に失敗しました');
    toast.add({ title: msg, color: 'error' });
  } finally {
    deleting.value = false;
  }
};

const buildActions = (user: User): DropdownMenuItem[][] => [
  [
    {
      label: '編集',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(user),
    },
  ],
  [
    {
      label: '削除',
      icon: 'i-lucide-trash-2',
      onSelect: () => openDelete(user),
    },
  ],
];

const columns: TableColumn<User>[] = [
  { accessorKey: 'name', header: '名前' },
  { accessorKey: 'email', header: 'メールアドレス' },
  { accessorKey: 'role', header: 'ロール' },
  { id: 'actions', header: '' },
];
</script>

<template>
  <UDashboardPanel id="users">
    <template #header>
      <UDashboardNavbar title="ユーザー管理" icon="i-lucide-users">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton color="primary" icon="i-lucide-plus" label="新規ユーザー" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UTable :data="users" :columns="columns" :ui="{ td: 'py-2' }">
        <template #name-cell="{ row }">
          <span class="font-medium">{{ row.original.name }}</span>
        </template>
        <template #email-cell="{ row }">
          <code class="text-xs font-mono text-muted">{{ row.original.email }}</code>
        </template>
        <template #role-cell="{ row }">
          <UBadge
            :color="USER_ROLE_COLOR[row.original.role]"
            variant="subtle"
            :label="USER_ROLE_LABEL[row.original.role]"
          />
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UDropdownMenu :items="buildActions(row.original)">
              <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>

      <UserFormModal v-model:open="formModalOpen" :user="editingUser" @saved="onSaved" />

      <AppModal
        v-model:open="deleteModalOpen"
        title="ユーザーを削除"
        :description="
          deleteTarget ? `「${deleteTarget.name}」(${deleteTarget.email}) を削除しますか?` : ''
        "
      >
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
              icon="i-lucide-trash-2"
              label="削除"
              @click="performDelete"
            />
          </div>
        </template>
      </AppModal>
    </template>
  </UDashboardPanel>
</template>
