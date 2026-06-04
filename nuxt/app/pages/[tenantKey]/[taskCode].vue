<script setup lang="ts">
import { apiResolveTaskByCode } from '~/api/tasks';

// 共有リンク /:tenantKey/:shortCode を解決し、既存のタスク詳細
// (/:tenantKey/projects/:projectId/tasks?task=:id) へリダイレクトする。
// projects / settings / login など同階層の静的ルートが優先されるため、
// ここに来るのは短縮コード（または不正なパス）のみ。
const route = useRoute();
const api = useApi();
const tenantKey = computed(() => route.params.tenantKey as string);
const taskCode = computed(() => route.params.taskCode as string);

onMounted(async () => {
  try {
    const { projectId, id } = await apiResolveTaskByCode(api, taskCode.value);
    await navigateTo(`/${tenantKey.value}/projects/${projectId}/tasks?task=${id}`, {
      replace: true,
    });
  } catch {
    // 見つからない / 不正なコードはテナントトップへ戻す
    await navigateTo(`/${tenantKey.value}`, { replace: true });
  }
});
</script>

<template>
  <div class="flex h-svh items-center justify-center text-muted">
    <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
  </div>
</template>
