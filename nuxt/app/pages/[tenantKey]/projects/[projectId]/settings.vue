<script setup lang="ts">
const route = useRoute();
const currentTenantKey = useCurrentTenantKey();

const projectId = computed(() => route.params.projectId as string);

const { data: projects } = await useProjects();
const project = computed(() => projects.value.find((p) => p.id === projectId.value));

// 設定画面（プロジェクト設定・マスタ・メンバー管理）はプロジェクトの管理なので、
// メンバーに加えてテナント admin も入れる（メンバーでない admin が自分をメンバーに追加できるように）。
// それ以外の閲覧のみの人は、直リンクで来てもタスク一覧へ送り返す。プロジェクト一覧を読んでから判定する
const { isAdmin } = useAuth();
const isReadonly = useProjectReadonly();
if (isReadonly.value && !isAdmin.value) {
  await navigateTo(`/${currentTenantKey.value}/projects/${projectId.value}/tasks`, {
    replace: true,
  });
}

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
