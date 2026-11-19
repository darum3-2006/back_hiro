<script setup lang="ts">
// テーマ切替: 初期は preference='system' のまま OS に追従。クリック時に
// 現在描画されている方の反対側 (light <-> dark) に preference を上書きする。
const colorMode = useColorMode();
const toggle = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
};
const icon = computed(() => (colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'));
const ariaLabel = computed(() =>
  colorMode.value === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え',
);
</script>

<template>
  <!-- アイコンだけのボタンなので、ツールチップで何のボタンかを出す -->
  <UTooltip :text="ariaLabel">
    <UButton
      color="neutral"
      variant="outline"
      :icon="icon"
      :aria-label="ariaLabel"
      @click="toggle"
    />
  </UTooltip>
</template>
