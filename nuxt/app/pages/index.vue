<script setup lang="ts">
// TODO(auth): 認証実装後はログイン状態 / 最後のテナント / ログイン画面のいずれかへ振り分ける。
// 現在はモックの開発用テナントへリダイレクト。
await navigateTo('/acme', { replace: true });
</script>

<template>
  <div />
</template>
