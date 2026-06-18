<script setup lang="ts">
import { apiGetNotificationPreferences, apiSetNotificationPreference } from '~/api/notifications';
import type { AppNotification } from '~/types/notification';
import { fmtRelative } from '~/utils/date';

const api = useApi();
const tenantKey = useCurrentTenantKey();

const tabs = [{ label: '通知', icon: 'i-lucide-bell', slot: 'notifications' as const }];

// 通知 ON/OFF 設定
const { data: prefs } = await useAsyncData(
  'notification-preferences',
  () => apiGetNotificationPreferences(api),
  { default: () => [] },
);
const togglePref = async (type: string, enabled: boolean) => {
  prefs.value = await apiSetNotificationPreference(api, type, enabled);
};

// 通知履歴（ベルと状態を共有）
const { items, unread, refresh, markRead, markAllRead } = useNotifications();
onMounted(() => {
  void refresh();
});

const openNotification = async (n: AppNotification) => {
  await markRead(n.id);
  if (n.projectId && n.taskSeq != null) {
    await navigateTo(`/${tenantKey.value}/projects/${n.projectId}/tasks?task=${n.taskSeq}`);
  }
};
</script>

<template>
  <UDashboardPanel id="me">
    <template #header>
      <UDashboardNavbar title="マイページ" icon="i-lucide-user">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-2xl p-4">
        <UTabs :items="tabs" variant="link">
          <template #notifications>
            <!-- 設定 -->
            <section class="mt-4 space-y-3">
              <h2 class="text-sm font-medium text-muted">通知する項目</h2>
              <div class="divide-y divide-default rounded-lg border border-default">
                <div
                  v-for="p in prefs"
                  :key="p.type"
                  class="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span class="text-sm">{{ p.label }}</span>
                  <USwitch
                    :model-value="p.enabled"
                    @update:model-value="(v: boolean) => togglePref(p.type, v)"
                  />
                </div>
              </div>
            </section>

            <!-- 履歴 -->
            <section class="mt-8 space-y-3">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-medium text-muted">通知履歴</h2>
                <UButton
                  v-if="unread > 0"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  label="すべて既読"
                  @click="markAllRead"
                />
              </div>
              <p v-if="items.length === 0" class="py-8 text-center text-sm text-muted">
                通知はありません
              </p>
              <div v-else class="divide-y divide-default rounded-lg border border-default">
                <button
                  v-for="n in items"
                  :key="n.id"
                  type="button"
                  class="flex w-full gap-2 px-4 py-3 text-left hover:bg-elevated/50"
                  :class="n.readAt ? '' : 'bg-primary/5'"
                  @click="openNotification(n)"
                >
                  <span
                    class="mt-1.5 size-2 shrink-0 rounded-full"
                    :class="n.readAt ? 'bg-transparent' : 'bg-primary'"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm">{{ n.message }}</span>
                    <span class="block text-xs text-muted">{{ fmtRelative(n.createdAt) }}</span>
                  </span>
                </button>
              </div>
            </section>
          </template>
        </UTabs>
      </div>
    </template>
  </UDashboardPanel>
</template>
