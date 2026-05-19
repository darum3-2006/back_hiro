<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui';
import { apiUpdateProject } from '~/api/projects';
import type { Project } from '~/types/project';

const api = useApi();
const { data: projects, refresh: refreshProjects } = await useProjects();
const projectCreateModalOpen = useProjectCreateModalOpen();
const currentTenantKey = useCurrentTenantKey();
const { me } = useAuth();
const isAdmin = computed(() => me.value?.role === 'admin');

const showArchived = ref(false);

const filteredProjects = computed(() => {
  if (showArchived.value) return projects.value;
  return projects.value.filter((p) => !p.archivedAt);
});

const archiveProject = async (id: string) => {
  await apiUpdateProject(api, id, { archived: true });
  await refreshProjects();
};

const unarchiveProject = async (id: string) => {
  await apiUpdateProject(api, id, { archived: false });
  await refreshProjects();
};

const buildActions = (project: Project): DropdownMenuItem[][] => {
  if (project.archivedAt) {
    // 復元は admin のみ
    if (!isAdmin.value) return [];
    return [
      [
        {
          label: '復元',
          icon: 'i-lucide-archive-restore',
          onSelect: () => unarchiveProject(project.id),
        },
      ],
    ];
  }
  const groups: DropdownMenuItem[][] = [
    [
      {
        label: '設定',
        icon: 'i-lucide-settings',
        to: `/${currentTenantKey.value}/projects/${project.id}/settings`,
      },
    ],
  ];
  // アーカイブは admin のみ
  if (isAdmin.value) {
    groups.push([
      {
        label: 'アーカイブ',
        icon: 'i-lucide-archive',
        onSelect: () => archiveProject(project.id),
      },
    ]);
  }
  return groups;
};

const columns: TableColumn<Project>[] = [
  { accessorKey: 'key', header: 'Key' },
  { accessorKey: 'name', header: '名前' },
  { accessorKey: 'description', header: '説明' },
  { accessorKey: 'archivedAt', header: 'ステータス' },
  { id: 'actions', header: '' },
];
</script>

<template>
  <UDashboardPanel id="projects">
    <template #header>
      <UDashboardNavbar title="プロジェクト" icon="i-lucide-folders">
        <template #right>
          <UCheckbox v-model="showArchived" label="アーカイブ済みも表示" />
          <UButton
            color="primary"
            icon="i-lucide-plus"
            label="新規プロジェクト"
            @click="projectCreateModalOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <EmptyState
        v-if="filteredProjects.length === 0"
        icon="i-lucide-folder-kanban"
        title="プロジェクトがまだありません"
        description="新規プロジェクトを作成して、タスクの管理を始めましょう"
      >
        <UButton
          color="primary"
          icon="i-lucide-plus"
          label="新規プロジェクト"
          @click="projectCreateModalOpen = true"
        />
      </EmptyState>

      <UTable v-else :data="filteredProjects" :columns="columns" :ui="{ td: 'py-2' }">
        <template #key-cell="{ row }">
          <code class="text-xs font-mono text-muted">{{ row.original.key }}</code>
        </template>
        <template #name-cell="{ row }">
          <span class="font-medium">{{ row.original.name }}</span>
        </template>
        <template #description-cell="{ row }">
          <span class="text-sm text-muted">{{ row.original.description ?? '—' }}</span>
        </template>
        <template #archivedAt-cell="{ row }">
          <UBadge
            v-if="row.original.archivedAt"
            color="neutral"
            variant="soft"
            label="アーカイブ済み"
          />
          <UBadge v-else color="success" variant="soft" label="アクティブ" />
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UDropdownMenu
              v-if="buildActions(row.original).length > 0"
              :items="buildActions(row.original)"
            >
              <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
