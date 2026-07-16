<script setup lang="ts">
const route = useRoute();
const currentTenantKey = useCurrentTenantKey();

// readonly（閲覧のみ）ユーザーは設定を変更できないため、直リンクで来てもタスク一覧へ送り返す
const { me, isReadonly } = useAuth();
if (me.value && isReadonly.value) {
  await navigateTo(`/${me.value.tenant.key}/projects/${route.params.projectId}/tasks`, {
    replace: true,
  });
}

const projectId = computed(() => route.params.projectId as string);

const { data: projects } = await useProjects();
const project = computed(() => projects.value.find((p) => p.id === projectId.value));

const settingsBase = computed(
  () => `/${currentTenantKey.value}/projects/${projectId.value}/settings`,
);

const tabs = computed(() => [
  [
    {
      label: 'General',
      icon: 'i-lucide-settings',
      to: settingsBase.value,
      exact: true,
    },
    {
      label: 'メンバー',
      icon: 'i-lucide-users',
      to: `${settingsBase.value}/members`,
    },
    {
      label: 'ステータス',
      icon: 'i-lucide-circle-dashed',
      to: `${settingsBase.value}/statuses`,
    },
    {
      label: '優先度',
      icon: 'i-lucide-flag',
      to: `${settingsBase.value}/priorities`,
    },
    {
      label: 'タグ',
      icon: 'i-lucide-tag',
      to: `${settingsBase.value}/tags`,
    },
    {
      label: 'フラグ',
      icon: 'i-lucide-bookmark',
      to: `${settingsBase.value}/flags`,
    },
  ],
]);
</script>

<template>
  <UDashboardPanel id="project-settings">
    <template #header>
      <UDashboardNavbar :title="project?.name ?? 'プロジェクト設定'" icon="i-lucide-settings-2">
        <template #leading>
          <UDashboardSidebarCollapse />
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            :to="`/${currentTenantKey}/projects`"
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
