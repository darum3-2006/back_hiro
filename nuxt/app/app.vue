<script setup lang="ts">
import type { Project } from '~/types/project';

useHead({
  htmlAttrs: { lang: 'ja' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
});

useSeoMeta({ title: 'プロジェクト管理' });

const route = useRoute();

const { data: projects, refresh: refreshProjects } = await useProjects();
const currentProjectId = useCurrentProjectId();
const projectCreateModalOpen = useProjectCreateModalOpen();

const activeProjects = computed(() => projects.value.filter((p) => !p.archivedAt));

const currentProject = computed(() => projects.value.find((p) => p.id === currentProjectId.value));

watchEffect(() => {
  // プロジェクト固有のルートにいるときだけ、現在プロジェクトが無効/アーカイブなら別へ自動遷移
  if (!route.params.projectId) return;
  const current = currentProject.value;
  if (!current || current.archivedAt) {
    const firstActive = activeProjects.value[0];
    if (firstActive) {
      navigateTo(`/projects/${firstActive.id}/tasks`, { replace: true });
    } else {
      navigateTo('/projects', { replace: true });
    }
  }
});

const projectMenuItems = computed(() => [
  activeProjects.value.map((p) => ({
    label: p.name,
    description: p.description ?? undefined,
    icon: p.id === currentProjectId.value ? 'i-lucide-check' : 'i-lucide-folder-kanban',
    onSelect: () => {
      navigateTo(`/projects/${p.id}/tasks`);
    },
  })),
  [
    {
      label: '新規プロジェクト',
      icon: 'i-lucide-plus',
      onSelect: () => {
        projectCreateModalOpen.value = true;
      },
    },
  ],
]);

const navItems = computed(() => [
  [
    {
      label: 'タスク一覧',
      icon: 'i-lucide-list-checks',
      to: currentProjectId.value ? `/projects/${currentProjectId.value}/tasks` : '/',
    },
  ],
  [{ label: 'プロジェクト', icon: 'i-lucide-folders', to: '/projects' }],
]);

const onProjectCreated = async (project: Project) => {
  await refreshProjects();
  await navigateTo(`/projects/${project.id}/tasks`);
};
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
              <span class="truncate flex-1 text-left">{{
                currentProject?.name ?? 'プロジェクト'
              }}</span>
            </UButton>
          </UDropdownMenu>
        </template>

        <UNavigationMenu :items="navItems" orientation="vertical" />

        <template #footer>
          <p class="px-2 py-1 text-xs text-muted">v0.0.1 (mockup)</p>
        </template>
      </UDashboardSidebar>

      <NuxtPage />
    </UDashboardGroup>

    <ProjectCreateModal v-model:open="projectCreateModalOpen" @created="onProjectCreated" />
  </UApp>
</template>
