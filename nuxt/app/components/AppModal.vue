<script setup lang="ts">
// UModal の透過ラッパー。props / slot をそのまま UModal へ渡しつつ、
// IME 変換キャンセルの ESC でモーダルが閉じてしまう問題だけを共通で抑止する
// （仕組みは useDialogImeEscapeGuard を参照）。
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** 開閉状態（IME 監視の付け外しに使うため明示的に受ける。v-model:open も可） */
  open?: boolean;
  /** DialogContent へ渡す追加バインド。onEscapeKeyDown とマージする */
  content?: Record<string, unknown>;
}>();

const onEscapeKeyDown = useDialogImeEscapeGuard(() => props.open);

const mergedContent = computed(() => ({ ...props.content, onEscapeKeyDown }));
</script>

<template>
  <UModal v-bind="$attrs" :open="open" :content="mergedContent">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UModal>
</template>
