<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'ja' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }]
})

useSeoMeta({ title: 'プロジェクト管理' })

const { data: projects } = await useProjects()
const currentProjectId = useCurrentProjectId()

const currentProject = computed(() =>
  projects.value.find(p => p.id === currentProjectId.value)
)

const projectMenuItems = computed(() => [
  projects.value.map(p => ({
    label: p.name,
    description: p.description ?? undefined,
    icon: p.id === currentProjectId.value ? 'i-lucide-check' : 'i-lucide-folder-kanban',
    onSelect: () => { currentProjectId.value = p.id }
  }))
])

const navItems = [
  [
    { label: 'タスク一覧', icon: 'i-lucide-list-checks', to: '/' }
  ]
]
</script>

<template>
  <UApp>
    <UDashboardGroup>
      <UDashboardSidebar
        id="default"
        collapsible
        resizable
        :default-size="18"
        :min-size="14"
        :max-size="28"
      >
        <template #header>
          <UDropdownMenu
            :items="projectMenuItems"
            :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width)' }"
          >
            <UButton
              color="neutral"
              variant="outline"
              block
              class="justify-between"
              trailing-icon="i-lucide-chevrons-up-down"
            >
              <UIcon name="i-lucide-folder-kanban" class="size-4" />
              <span class="truncate flex-1 text-left">{{ currentProject?.name ?? 'プロジェクト' }}</span>
            </UButton>
          </UDropdownMenu>
        </template>

        <UNavigationMenu :items="navItems" orientation="vertical" />

        <template #footer>
          <p class="px-2 py-1 text-xs text-muted">
            v0.0.1 (mockup)
          </p>
        </template>
      </UDashboardSidebar>

      <NuxtPage />
    </UDashboardGroup>
  </UApp>
</template>
