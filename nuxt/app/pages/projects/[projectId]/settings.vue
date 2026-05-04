<script setup lang="ts">
const route = useRoute()

const projectId = computed(() => route.params.projectId as string)

const { data: projects } = await useProjects()
const project = computed(() => projects.value.find((p) => p.id === projectId.value))

const tabs = computed(() => [
  [
    {
      label: 'General',
      icon: 'i-lucide-settings',
      to: `/projects/${projectId.value}/settings`,
      exact: true
    },
    {
      label: 'メンバー',
      icon: 'i-lucide-users',
      to: `/projects/${projectId.value}/settings/members`
    },
    {
      label: 'ステータス',
      icon: 'i-lucide-circle-dashed',
      to: `/projects/${projectId.value}/settings/statuses`
    },
    {
      label: '優先度',
      icon: 'i-lucide-flag',
      to: `/projects/${projectId.value}/settings/priorities`
    },
    {
      label: 'タグ',
      icon: 'i-lucide-tag',
      to: `/projects/${projectId.value}/settings/tags`
    }
  ]
])
</script>

<template>
  <UDashboardPanel id="project-settings">
    <template #header>
      <UDashboardNavbar :title="project?.name ?? 'プロジェクト設定'" icon="i-lucide-settings-2">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/projects"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UNavigationMenu :items="tabs" orientation="horizontal" class="border-b border-default" />
      <NuxtPage />
    </template>
  </UDashboardPanel>
</template>
