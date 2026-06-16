<script setup lang="ts">
import { apiResolveSavedViewByCode } from '~/api/saved-views';

// 共有リンク /:tenantKey/v/:code を解決し、ビューを選択した状態の
// タスク一覧 (/:tenantKey/projects/:projectId/tasks?view=:viewId) へリダイレクトする。
const route = useRoute();
const api = useApi();
const tenantKey = computed(() => route.params.tenantKey as string);
const code = computed(() => route.params.code as string);

onMounted(async () => {
  try {
    const { projectId, viewId } = await apiResolveSavedViewByCode(api, code.value);
    await navigateTo(`/${tenantKey.value}/projects/${projectId}/tasks?view=${viewId}`, {
      replace: true,
    });
  } catch {
    // 見つからない / アクセス権なし / 不正なコードはテナントトップへ戻す
    await navigateTo(`/${tenantKey.value}`, { replace: true });
  }
});
</script>

<template>
  <div class="flex h-svh items-center justify-center text-muted">
    <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
  </div>
</template>
