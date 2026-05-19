<script setup lang="ts">
const config = useRuntimeConfig();
const envLabel = (config.public.envLabel as string) || '';

useHead({
  htmlAttrs: { lang: 'ja' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  // 実行環境を識別できるよう、ラベルがあればタブタイトルに前置する。
  titleTemplate: (title) => {
    const base = title ?? 'プロジェクト管理【Backひろ】';
    return envLabel ? `[${envLabel}] ${base}` : base;
  },
});

useSeoMeta({ title: 'プロジェクト管理【Backひろ】' });
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
