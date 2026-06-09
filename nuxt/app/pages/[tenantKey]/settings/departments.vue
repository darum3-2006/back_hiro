<script setup lang="ts">
import { h, resolveComponent } from 'vue';
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui';
import { apiDeleteDepartment } from '~/api/masters';
import type { Department } from '~/types/master';

const UButton = resolveComponent('UButton');

const { me } = useAuth();
const api = useApi();
const toast = useToast();

// admin 以外がアクセスしたらテナントトップへ送り返す
if (me.value && me.value.role !== 'admin') {
  await navigateTo(`/${me.value.tenant.key}`, { replace: true });
}

const { data: departments, refresh: refreshDepartments } = await useDepartments();

// ===== Add / Edit =====
const formModalOpen = ref(false);
const editingDepartment = ref<Department | null>(null);

const openCreate = () => {
  editingDepartment.value = null;
  formModalOpen.value = true;
};

const openEdit = (department: Department) => {
  editingDepartment.value = department;
  formModalOpen.value = true;
};

const onSaved = async (saved: Department) => {
  await refreshDepartments();
  toast.add({
    title: editingDepartment.value ? '部署を更新しました' : '部署を追加しました',
    description: `${saved.name} (${saved.code})`,
    color: 'success',
    icon: 'i-lucide-check',
  });
};

// ===== Delete =====
const deleteModalOpen = ref(false);
const deleteTarget = ref<Department | null>(null);
const deleting = ref(false);

const openDelete = (department: Department) => {
  deleteTarget.value = department;
  deleteModalOpen.value = true;
};

const performDelete = async () => {
  if (!deleteTarget.value) return;
  deleting.value = true;
  const name = deleteTarget.value.name;
  try {
    await apiDeleteDepartment(api, deleteTarget.value.code);
    await refreshDepartments();
    deleteModalOpen.value = false;
    toast.add({
      title: '部署を削除しました',
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
      : (data.message ?? '部署の削除に失敗しました');
    toast.add({ title: msg, color: 'error' });
  } finally {
    deleting.value = false;
  }
};

const buildActions = (department: Department): DropdownMenuItem[][] => [
  [
    {
      label: '編集',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(department),
    },
  ],
  [
    {
      label: '削除',
      icon: 'i-lucide-trash-2',
      onSelect: () => openDelete(department),
    },
  ],
];

// ===== Sorting（ヘッダクリックで 未ソート→昇順→降順 を循環） =====
const sorting = ref<{ id: string; desc: boolean }[]>([]);

interface SortColumn {
  getIsSorted: () => false | 'asc' | 'desc';
  toggleSorting: () => void;
}

const sortHeader = (label: string) => {
  return ({ column }: { column: SortColumn }) => {
    const sorted = column.getIsSorted();
    return h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      label,
      class: '-mx-2.5',
      icon:
        sorted === 'asc'
          ? 'i-lucide-arrow-up'
          : sorted === 'desc'
            ? 'i-lucide-arrow-down'
            : 'i-lucide-arrow-up-down',
      onClick: () => column.toggleSorting(),
    });
  };
};

const columns: TableColumn<Department>[] = [
  { accessorKey: 'code', header: sortHeader('コード') },
  { accessorKey: 'name', header: sortHeader('部署名') },
  { id: 'actions', header: '' },
];
</script>

<template>
  <UDashboardPanel id="departments">
    <template #header>
      <UDashboardNavbar title="部署管理" icon="i-lucide-building-2">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton color="primary" icon="i-lucide-plus" label="新規部署" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EmptyState
        v-if="departments.length === 0"
        icon="i-lucide-building-2"
        title="部署がまだありません"
        description="新規部署を追加すると、タスクの起票部署として選べるようになります"
      >
        <UButton color="primary" icon="i-lucide-plus" label="新規部署" @click="openCreate" />
      </EmptyState>

      <UTable
        v-else
        v-model:sorting="sorting"
        :data="departments"
        :columns="columns"
        :ui="{ td: 'py-2' }"
      >
        <template #code-cell="{ row }">
          <code class="text-xs font-mono text-muted">{{ row.original.code }}</code>
        </template>
        <template #name-cell="{ row }">
          <span class="font-medium">{{ row.original.name }}</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UDropdownMenu :items="buildActions(row.original)">
              <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>

      <DepartmentFormModal
        v-model:open="formModalOpen"
        :department="editingDepartment"
        @saved="onSaved"
      />

      <UModal
        v-model:open="deleteModalOpen"
        title="部署を削除"
        :description="
          deleteTarget
            ? `「${deleteTarget.name}」(${deleteTarget.code}) を削除しますか? この部署を起票部署にしているタスクは未設定に戻ります。`
            : ''
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
      </UModal>
    </template>
  </UDashboardPanel>
</template>
