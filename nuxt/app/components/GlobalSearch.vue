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
  <!-- タスク詳細スライドオーバー(z-50)より前面に出す。重ねても薄くならないよう z を上げる -->
  <UModal v-model:open="open" :ui="{ overlay: 'z-[60]', content: 'z-[60] sm:max-w-2xl' }">
    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        :loading="loading"
        :close="true"
        placeholder="タスクを検索（タイトル・説明・URL・コード）…"
        class="h-96"
      >
        <!-- 入力欄右の close 位置を「クリア」に転用。入力があるときだけ × を出す -->
        <template #close>
          <UButton
            v-if="searchTerm"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            aria-label="検索ワードをクリア"
            @click="searchTerm = ''"
          />
        </template>

        <!-- 既定の「No data」「No matching data」を日本語に。入力前と該当なしで出し分ける -->
        <template #empty="{ searchTerm: term }">
          <div class="py-6 text-center text-sm text-muted">
            <template v-if="loading">検索中…</template>
            <template v-else-if="!term || !term.trim()">キーワードを入力してタスクを検索</template>
            <template v-else>「{{ term }}」に一致するタスクはありません</template>
          </div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
