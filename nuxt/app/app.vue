<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'ja' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
});

useSeoMeta({ title: 'プロジェクト管理' });
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
