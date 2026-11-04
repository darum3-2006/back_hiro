<script setup lang="ts">
/**
 * タスク一覧の「最新コメント表示」モードで使う本文プレビュー。
 * 4 行で省略し、実際に省略されている（はみ出している）ときだけ
 * 本文 or「続きを表示」クリックで全文に展開できる。
 * 省略判定は文字数ではなく描画結果（scrollHeight）で行うので、列幅の変化にも追従する。
 */
const props = defineProps<{ body: string }>();

const text = computed(() => props.body.trim());
const expanded = ref(false);
/** 折りたたみ時に 4 行からはみ出しているか */
const overflowing = ref(false);
const el = ref<HTMLElement | null>(null);

const measure = () => {
  const e = el.value;
  // 展開中は全文が見えているので測れない。折りたたみ時の判定結果を保持する
  if (!e || expanded.value) return;
  overflowing.value = e.scrollHeight > e.clientHeight + 1;
};

let observer: ResizeObserver | null = null;
onMounted(() => {
  measure();
  if (!el.value) return;
  // 列幅のリサイズで折り返し行数が変わるので、要素サイズの変化で再判定する
  observer = new ResizeObserver(measure);
  observer.observe(el.value);
});
onBeforeUnmount(() => observer?.disconnect());
watch(text, () => nextTick(measure));
watch(expanded, (v) => {
  if (!v) void nextTick(measure);
});

const canToggle = computed(() => expanded.value || overflowing.value);
const toggle = () => {
  if (canToggle.value) expanded.value = !expanded.value;
};
</script>

<template>
  <div>
    <!-- pre-wrap なのでテンプレート側の改行・インデントが混ざらないよう v-text で入れる -->
    <p
      ref="el"
      class="text-muted whitespace-pre-wrap break-words"
      :class="[
        expanded ? '' : 'line-clamp-4',
        canToggle ? 'cursor-pointer hover:text-default' : '',
      ]"
      :title="canToggle ? (expanded ? 'クリックで折りたたむ' : 'クリックで全文を表示') : undefined"
      @click="toggle"
      v-text="text"
    />
    <button
      v-if="canToggle"
      type="button"
      class="mt-0.5 text-primary hover:underline cursor-pointer"
      :aria-expanded="expanded"
      @click="toggle"
    >
      {{ expanded ? '折りたたむ' : '続きを表示' }}
    </button>
  </div>
</template>
