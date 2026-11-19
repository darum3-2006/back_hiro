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
// 検索の世代番号。応答は送信順に返るとは限らないので、最新の検索の応答だけを反映する。
// （IME 変換や F8/F10 の全角→半角変換で入力値が短時間に続けて変わると、
//   古い入力の応答が後から届いて新しい結果を上書きし、次に入力するまで直らなかった）
let latestSearch = 0;
const scheduleSearch = (raw: string) => {
  if (timer) clearTimeout(timer);
  const current = ++latestSearch;
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
        const found = await apiSearchTasks(api, q);
        if (current === latestSearch) results.value = found;
      } catch {
        if (current === latestSearch) results.value = [];
      } finally {
        if (current === latestSearch) loading.value = false;
      }
    })();
  }, 250);
};
// IME 変換中は検索語（入力欄の表示）だけ追従させ、サーバ検索は変換確定時に行う
watch(searchTerm, (raw) => {
  if (!composing) scheduleSearch(raw);
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

// ===== IME 変換中の入力値の扱い =====
// UCommandPalette の入力（reka-ui の ListboxFilter）は、IME 変換中の入力を検索語に反映せず
// 保留する一方で、入力欄の value には保留中の（古い）検索語をバインドしている。そのため変換中に
// 何かで再描画される（検索結果の到着・マウスでのハイライト移動など）と、Vue が value を古い
// 検索語で上書きし、変換が compositionend なしで壊れる。Chrome + Google 日本語入力の F8/F10
// （いったん確定 → 半角で再変換）でちょうどこれが起き、全角に戻ったうえ reka-ui が変換中の
// まま固まって、以降の入力が検索されなかった（ダイアログを開き直すまで直らない）。
// 対策:
// 1. 検索語を変換中も含めて入力欄の実際の値に常に揃える（再描画されても上書きが起きない）。
//    サーバ検索だけは変換中は送らず、変換確定時に送る
// 2. それでも変換が打ち切られた場合（変換中のはずなのに非変換中のキー入力/入力が来た）は、
//    reka-ui に compositionend を通知し直して、矢印キー・Enter が効かない状態を戻す
let composing = false;
const onCompositionStart = () => {
  composing = true;
};
const onCompositionEnd = (e: Event) => {
  composing = false;
  const el = e.target as HTMLInputElement | null;
  if (el?.tagName === 'INPUT') searchTerm.value = el.value;
  scheduleSearch(searchTerm.value);
};
const syncSearchTerm = (e: Event) => {
  const el = e.target as HTMLInputElement | null;
  if (el?.tagName === 'INPUT') searchTerm.value = el.value;
};
const recoverAbortedComposition = (e: Event) => {
  if (!composing || (e as KeyboardEvent | InputEvent).isComposing) return;
  const el = e.target as HTMLInputElement | null;
  if (!el || el.tagName !== 'INPUT') return;
  composing = false;
  el.dispatchEvent(new CompositionEvent('compositionend', { data: el.value }));
};
</script>

<template>
  <!-- タスク詳細スライドオーバー(z-50)より前面に出す。重ねても薄くならないよう z を上げる -->
  <AppModal v-model:open="open" :ui="{ overlay: 'z-[60]', content: 'z-[60] sm:max-w-2xl' }">
    <template #content>
      <!-- 入力欄の composition / keydown / input を先取りして、IME 変換中も検索語を入力値に揃える -->
      <div
        class="contents"
        @compositionstart.capture="onCompositionStart"
        @compositionend.capture="onCompositionEnd"
        @keydown.capture="recoverAbortedComposition"
        @beforeinput.capture="recoverAbortedComposition"
        @input.capture="syncSearchTerm"
      >
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
              <template v-else-if="!term || !term.trim()"
                >キーワードを入力してタスクを検索</template
              >
              <template v-else>「{{ term }}」に一致するタスクはありません</template>
            </div>
          </template>
        </UCommandPalette>
      </div>
    </template>
  </AppModal>
</template>
