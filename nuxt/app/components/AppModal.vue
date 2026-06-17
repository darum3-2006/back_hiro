<script setup lang="ts">
// UModal の透過ラッパー。props / slot をそのまま UModal へ渡しつつ、
// IME 変換キャンセルの ESC でモーダルが閉じてしまう問題だけを共通で抑止する。
// （Reka UI は escapeKeyDown が preventDefault されていなければ dismiss するため、
//   変換中だけ preventDefault する。content はポータル描画なので document で監視する。）
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** 開閉状態（IME 監視の付け外しに使うため明示的に受ける。v-model:open も可） */
  open?: boolean;
  /** DialogContent へ渡す追加バインド。onEscapeKeyDown とマージする */
  content?: Record<string, unknown>;
}>();

// IME 変換中フラグ。モーダルが開いている間だけ document の composition を監視する。
const composing = ref(false);
const onCompositionStart = () => {
  composing.value = true;
};
const onCompositionEnd = () => {
  composing.value = false;
};

const bindComposition = () => {
  document.addEventListener('compositionstart', onCompositionStart, true);
  document.addEventListener('compositionend', onCompositionEnd, true);
};
const unbindComposition = () => {
  composing.value = false;
  document.removeEventListener('compositionstart', onCompositionStart, true);
  document.removeEventListener('compositionend', onCompositionEnd, true);
};

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) return;
    if (open) bindComposition();
    else unbindComposition();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (import.meta.client) unbindComposition();
});

/** IME 変換キャンセル（変換中）の ESC ではモーダルを閉じない */
const onEscapeKeyDown = (e: Event) => {
  if (composing.value || (e as KeyboardEvent).isComposing) e.preventDefault();
};

const mergedContent = computed(() => ({ ...props.content, onEscapeKeyDown }));
</script>

<template>
  <UModal v-bind="$attrs" :open="open" :content="mergedContent">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UModal>
</template>
