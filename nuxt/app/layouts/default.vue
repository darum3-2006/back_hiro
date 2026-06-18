<script setup lang="ts">
import type { Project } from '~/types/project';

const route = useRoute();

const { data: projects, refresh: refreshProjects } = await useProjects();
const currentTenantKey = useCurrentTenantKey();
const currentProjectId = useCurrentProjectId();
const projectCreateModalOpen = useProjectCreateModalOpen();
const { me } = useAuth();

// グローバル検索（Cmd/Ctrl+K で起動）
const searchOpen = ref(false);
defineShortcuts({
  meta_k: () => {
    searchOpen.value = true;
  },
});

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
  // 現在プロジェクトが無いとき「タスク一覧」をホーム(/${tk})に向けると active が
  // ホームと衝突するため、先頭のアクティブプロジェクト（無ければプロジェクト一覧）へ。
  const firstActive = activeProjects.value[0];
  const tasksTo = currentProjectId.value
    ? `/${tk}/projects/${currentProjectId.value}/tasks`
    : firstActive
      ? `/${tk}/projects/${firstActive.id}/tasks`
      : `/${tk}/projects`;
  const groups = [
    // ホームは exact 一致のみ active（配下ルートで点灯させない）
    [{ label: 'ホーム', icon: 'i-lucide-house', to: `/${tk}`, exact: true }],
    [
      {
        label: '検索',
        icon: 'i-lucide-search',
        // クリックでコマンドパレットを開く（Cmd/Ctrl+K でも起動）
        onSelect: () => {
          searchOpen.value = true;
        },
      },
    ],
    [{ label: 'タスク一覧', icon: 'i-lucide-list-checks', to: tasksTo }],
  ];
  // ガントは現在プロジェクトがあるときだけ（タスク一覧の直下に並べる）
  if (currentProjectId.value) {
    groups.push([
      {
        label: 'ガント',
        icon: 'i-lucide-chart-gantt',
        to: `/${tk}/projects/${currentProjectId.value}/gantt`,
      },
    ]);
  }
  groups.push([{ label: 'プロジェクト', icon: 'i-lucide-folders', to: `/${tk}/projects` }]);
  // admin だけテナント設定（ユーザー管理・部署管理など）を表示
  if (me.value?.role === 'admin') {
    groups.push([
      { label: 'ユーザー管理', icon: 'i-lucide-users', to: `/${tk}/settings/users` },
      { label: '部署管理', icon: 'i-lucide-building-2', to: `/${tk}/settings/departments` },
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
const apiKeyModalOpen = ref(false);

const accountMenuItems = computed(() => {
  const account = [
    {
      label: 'マイページ',
      icon: 'i-lucide-user',
      onSelect: () => {
        navigateTo(`/${currentTenantKey.value}/me`);
      },
    },
    {
      label: 'パスワード変更',
      icon: 'i-lucide-key-round',
      onSelect: () => {
        passwordModalOpen.value = true;
      },
    },
  ];
  // APIキーは admin / power_user のみ発行・利用できる
  if (canUseApiKey(me.value?.role)) {
    account.push({
      label: 'APIキー',
      icon: 'i-lucide-key',
      onSelect: () => {
        apiKeyModalOpen.value = true;
      },
    });
  }
  return [account, [{ label: 'ログアウト', icon: 'i-lucide-log-out', onSelect: onLogout }]];
});
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
      <template #header="{ collapsed }">
        <UDropdownMenu
          :items="projectMenuItems"
          :ui="{ content: collapsed ? undefined : 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            color="neutral"
            variant="outline"
            :block="!collapsed"
            :square="collapsed"
            :class="collapsed ? undefined : 'justify-between'"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
            :aria-label="
              collapsed ? `プロジェクト: ${currentProject?.name ?? 'プロジェクト'}` : undefined
            "
          >
            <UIcon name="i-lucide-folder-kanban" class="size-4" />
            <span v-if="!collapsed" class="truncate flex-1 text-left">{{
              currentProject?.name ?? 'プロジェクト'
            }}</span>
          </UButton>
        </UDropdownMenu>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :items="navItems" orientation="vertical" :collapsed="collapsed" />
      </template>

      <template #footer="{ collapsed }">
        <NotificationBell :collapsed="collapsed" />
        <UDropdownMenu
          :items="accountMenuItems"
          :ui="{ content: collapsed ? undefined : 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            :block="!collapsed"
            :square="collapsed"
            :class="collapsed ? undefined : 'justify-start gap-2'"
            :aria-label="`アカウントメニュー: ${me?.name ?? ''}`"
          >
            <UIcon name="i-lucide-circle-user-round" class="size-5 text-muted shrink-0" />
            <template v-if="!collapsed">
              <span class="text-sm truncate flex-1 text-left">{{ me?.name ?? '' }}</span>
              <UIcon name="i-lucide-chevrons-up-down" class="size-4 text-muted shrink-0" />
            </template>
          </UButton>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>

  <ProjectCreateModal v-model:open="projectCreateModalOpen" @created="onProjectCreated" />
  <PasswordChangeModal v-model:open="passwordModalOpen" />
  <ApiKeyModal v-model:open="apiKeyModalOpen" />
  <GlobalSearch v-model:open="searchOpen" />
</template>
