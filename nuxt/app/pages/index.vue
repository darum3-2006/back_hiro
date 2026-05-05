<script setup lang="ts">
// トップは「テナントキー入りURL」へ振り分けるだけのページ。
// - ログイン済みなら自分のテナントへ
// - 未ログインなら、テナントキーが分からないので案内表示
const { token, me, fetchMe } = useAuth();
const ready = ref(false);

onMounted(async () => {
  if (token.value && !me.value) {
    await fetchMe();
  }
  if (me.value) {
    navigateTo(`/${me.value.tenant.key}`, { replace: true });
    return;
  }
  ready.value = true;
});
</script>

<template>
  <div v-if="ready" class="min-h-screen flex items-center justify-center px-4">
    <UCard class="max-w-md text-center">
      <p class="text-sm">
        URL にテナントキーを含めてアクセスしてください（例: <code>/your-tenant</code>）。
      </p>
    </UCard>
  </div>
</template>
