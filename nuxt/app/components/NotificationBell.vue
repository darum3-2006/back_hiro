<script setup lang="ts">
import type { AppNotification } from '~/types/notification';
import { fmtRelative } from '~/utils/date';

defineProps<{ collapsed?: boolean }>();

const { items, unread, refresh, markRead, markAllRead, connect } = useNotifications();
const tenantKey = useCurrentTenantKey();
const open = ref(false);

onMounted(() => {
  connect();
  void refresh();
});

const unreadLabel = computed(() => (unread.value > 99 ? '99+' : String(unread.value)));

const onOpenNotification = async (n: AppNotification) => {
  open.value = false;
  await markRead(n.id);
  if (n.projectId && n.taskSeq != null) {
    await navigateTo(`/${tenantKey.value}/projects/${n.projectId}/tasks?task=${n.taskSeq}`);
  }
};
</script>

<template>
  <UPopover v-model:open="open" :ui="{ content: 'w-80' }">
    <UButton
      color="neutral"
      variant="ghost"
      :block="!collapsed"
      :square="collapsed"
      :class="!collapsed ? 'justify-start gap-2' : undefined"
      aria-label="通知"
    >
      <span class="relative inline-flex shrink-0">
        <UIcon name="i-lucide-bell" class="size-5 text-muted" />
        <span
          v-if="unread > 0"
          class="absolute -right-2 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-xs font-medium leading-none text-white"
        >
          {{ unreadLabel }}
        </span>
      </span>
      <span v-if="!collapsed" class="text-sm flex-1 text-left">通知</span>
    </UButton>

    <template #content>
      <div class="flex items-center justify-between border-b border-default px-3 py-2">
        <span class="text-sm font-medium">通知</span>
        <UButton
          v-if="unread > 0"
          size="xs"
          variant="ghost"
          color="neutral"
          label="すべて既読"
          @click="markAllRead"
        />
      </div>
      <div class="max-h-96 overflow-y-auto">
        <p v-if="items.length === 0" class="px-3 py-6 text-center text-sm text-muted">
          通知はありません
        </p>
        <button
          v-for="n in items"
          :key="n.id"
          type="button"
          class="flex w-full gap-2 px-3 py-2 text-left hover:bg-elevated/50"
          :class="n.readAt ? '' : 'bg-primary/5'"
          @click="onOpenNotification(n)"
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
      <div class="border-t border-default">
        <UButton
          block
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-settings"
          label="通知設定"
          :to="`/${tenantKey}/me`"
          @click="open = false"
        />
      </div>
    </template>
  </UPopover>
</template>
