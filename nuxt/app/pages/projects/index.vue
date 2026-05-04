<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui'
import { updateProject } from '~/api/projects'
import type { Project } from '~/types/project'

const { data: projects, refresh: refreshProjects } = await useProjects()
const projectCreateModalOpen = useProjectCreateModalOpen()

const showArchived = ref(false)

const filteredProjects = computed(() => {
  if (showArchived.value) return projects.value
  return projects.value.filter((p) => !p.archivedAt)
})

const archiveProject = async (id: string) => {
  await updateProject(id, { archivedAt: new Date().toISOString().slice(0, 19) })
  await refreshProjects()
}

const unarchiveProject = async (id: string) => {
  await updateProject(id, { archivedAt: null })
  await refreshProjects()
}

const buildActions = (project: Project): DropdownMenuItem[][] => {
  if (project.archivedAt) {
    return [
      [
        {
          label: '復元',
          icon: 'i-lucide-archive-restore',
          onSelect: () => unarchiveProject(project.id)
        }
      ]
    ]
  }
  return [
    [
      {
        label: '設定',
        icon: 'i-lucide-settings',
        to: `/projects/${project.id}/settings`
      }
    ],
    [
      {
        label: 'アーカイブ',
        icon: 'i-lucide-archive',
        onSelect: () => archiveProject(project.id)
      }
    ]
  ]
}

const columns: TableColumn<Project>[] = [
  { accessorKey: 'key', header: 'Key' },
  { accessorKey: 'name', header: '名前' },
  { accessorKey: 'description', header: '説明' },
  { accessorKey: 'archivedAt', header: 'ステータス' },
  { id: 'actions', header: '' }
]
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
      <UTable :data="filteredProjects" :columns="columns" :ui="{ td: 'py-2' }">
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
            <UDropdownMenu :items="buildActions(row.original)">
              <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
