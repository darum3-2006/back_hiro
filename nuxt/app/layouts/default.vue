<script setup lang="ts">
import type { Project } from '~/types/project';

const route = useRoute();

const { data: projects, refresh: refreshProjects } = await useProjects();
const currentTenantKey = useCurrentTenantKey();
const currentProjectId = useCurrentProjectId();
const projectCreateModalOpen = useProjectCreateModalOpen();
const { me } = useAuth();

const activeProjects = computed(() => projects.value.filter((p) => !p.archivedAt));

const currentProject = computed(() => projects.value.find((p) => p.id === currentProjectId.value));

watchEffect(() => {
  // プロジェクト固有のルートにいるときだけ、現在プロジェクトが無効/アーカイブなら別へ自動遷移
  if (!route.params.projectId) return;
  const tenantKey = currentTenantKey.value;
  if (!tenantKey) return;
  const current = currentProject.value;
  if (!current || current.archivedAt) {
    const firstActive = activeProjects.value[0];
    if (firstActive) {
      navigateTo(`/${tenantKey}/projects/${firstActive.id}/tasks`, { replace: true });
    } else {
      navigateTo(`/${tenantKey}/projects`, { replace: true });
    }
  }
});

const projectMenuItems = computed(() => [
  activeProjects.value.map((p) => ({
    label: p.name,
    description: p.description ?? undefined,
    icon: p.id === currentProjectId.value ? 'i-lucide-check' : 'i-lucide-folder-kanban',
    onSelect: () => {
      navigateTo(`/${currentTenantKey.value}/projects/${p.id}/tasks`);
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

const navItems = computed(() => {
  const tk = currentTenantKey.value;
  if (!tk) return [];
  const groups = [
    [
      {
        label: 'タスク一覧',
        icon: 'i-lucide-list-checks',
        to: currentProjectId.value
          ? `/${tk}/projects/${currentProjectId.value}/tasks`
          : `/${tk}`,
      },
    ],
    [{ label: 'プロジェクト', icon: 'i-lucide-folders', to: `/${tk}/projects` }],
  ];
  // admin だけテナント設定（ユーザー管理など）を表示
  if (me.value?.role === 'admin') {
    groups.push([
      { label: 'ユーザー管理', icon: 'i-lucide-users', to: `/${tk}/settings/users` },
    ]);
  }
  return groups;
});

const onProjectCreated = async (project: Project) => {
  await refreshProjects();
  await navigateTo(`/${currentTenantKey.value}/projects/${project.id}/tasks`);
};

const onLogout = () => {
  const tk = me.value?.tenant?.key ?? currentTenantKey.value;
  document.cookie = 'auth_token=; Path=/; Max-Age=0; SameSite=Lax';
  window.location.href = tk ? `/${tk}/login` : '/';
};

const passwordModalOpen = ref(false);

const accountMenuItems = computed(() => [
  [
    {
      label: 'パスワード変更',
      icon: 'i-lucide-key-round',
      onSelect: () => {
        passwordModalOpen.value = true;
      },
    },
  ],
  [
    {
      label: 'ログアウト',
      icon: 'i-lucide-log-out',
      onSelect: onLogout,
    },
  ],
]);
</script>

<template>
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
        <UDropdownMenu
          :items="accountMenuItems"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            block
            class="justify-start gap-2"
            :aria-label="`アカウントメニュー: ${me?.name ?? ''}`"
          >
            <UIcon name="i-lucide-circle-user-round" class="size-5 text-muted shrink-0" />
            <span class="text-sm truncate flex-1 text-left">{{ me?.name ?? '' }}</span>
            <UIcon name="i-lucide-chevrons-up-down" class="size-4 text-muted shrink-0" />
          </UButton>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>

  <ProjectCreateModal v-model:open="projectCreateModalOpen" @created="onProjectCreated" />
  <PasswordChangeModal v-model:open="passwordModalOpen" />
</template>
