<script setup lang="ts">
import { apiSearchTasks } from '~/api/tasks';
import type { TaskSearchResult } from '~/types/task';

// 開閉状態は親（レイアウト）と v-model:open で共有（検索ボタン / Cmd+K から開く）
const open = defineModel<boolean>('open', { default: false });

const api = useApi();
const tenantKey = useCurrentTenantKey();

const searchTerm = ref('');
const results = ref<TaskSearchResult[]>([]);
const loading = ref(false);

// 入力をデバウンスしてサーバ検索（クライアント側フィルタは ignoreFilter で無効化）
let timer: ReturnType<typeof setTimeout> | null = null;
watch(searchTerm, (raw) => {
  if (timer) clearTimeout(timer);
  const q = raw.trim();
  if (!q) {
    results.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  timer = setTimeout(() => {
    void (async () => {
      try {
        results.value = await apiSearchTasks(api, q);
      } catch {
        results.value = [];
      } finally {
        loading.value = false;
      }
    })();
  }, 250);
});

const groups = computed(() => [
  {
    id: 'tasks',
    // サーバ検索の結果をそのまま出す（UCommandPalette 内蔵の絞り込みを無効化）
    ignoreFilter: true,
    items: results.value.map((r) => ({
      label: `#${r.seq}  ${r.content}`,
      suffix: r.projectName,
      icon: 'i-lucide-square-check-big',
      onSelect: () => {
        open.value = false;
        void navigateTo(`/${tenantKey.value}/${r.shortCode}`);
      },
    })),
  },
]);

// 閉じたら状態をリセット
watch(open, (v) => {
  if (!v) {
    searchTerm.value = '';
    results.value = [];
    loading.value = false;
  }
});
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-2xl' }">
    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        :loading="loading"
        placeholder="タスクを検索（タイトル・説明・コード）…"
        class="h-96"
      />
    </template>
  </UModal>
</template>
