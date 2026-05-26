<script setup lang="ts">
definePageMeta({ layout: 'blank' });

const route = useRoute();
const tenantKey = computed(() => (route.params.tenantKey as string | undefined) ?? '');

const { login, token, fetchMe } = useAuth();
const toast = useToast();

const email = ref('');
const password = ref('');
const submitting = ref(false);

/**
 * セッション切れで login へ飛ばされる際に付与された ?redirect= を解決する。
 * 同テナント配下のパスのみ許可し、login 自身や外部 URL（//evil.com 等）は弾く。
 */
const resolveRedirect = (): string => {
  const fallback = `/${tenantKey.value}`;
  const raw = route.query.redirect;
  const target = typeof raw === 'string' ? raw : '';
  if (!target) return fallback;
  if (target.startsWith('//')) return fallback;
  if (!target.startsWith(`/${tenantKey.value}/`)) return fallback;
  if (target === `/${tenantKey.value}/login`) return fallback;
  if (target.startsWith(`/${tenantKey.value}/login?`)) return fallback;
  return target;
};

// 既にログイン済みなら自動で元のページ（無ければテナントトップ）へ。
onMounted(async () => {
  if (!token.value) return;
  const me = await fetchMe();
  if (me) {
    await navigateTo(resolveRedirect(), { replace: true });
  }
});

const onSubmit = async () => {
  if (!tenantKey.value) return;
  if (!email.value || !password.value) {
    toast.add({ title: 'メールアドレスとパスワードを入力してください', color: 'warning' });
    return;
  }
  submitting.value = true;
  try {
    await login({
      tenantKey: tenantKey.value,
      email: email.value,
      password: password.value,
    });
    // SPA ナビゲーションで Suspense が解決しないケースを回避するためハード遷移
    window.location.href = resolveRedirect();
  } catch (e: unknown) {
    submitting.value = false;
    const message =
      typeof e === 'object' && e !== null && 'data' in e
        ? ((e as { data?: { message?: string } }).data?.message ?? 'ログインに失敗しました')
        : 'ログインに失敗しました';
    toast.add({ title: message, color: 'error' });
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-default">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="space-y-1">
          <h1 class="text-lg font-semibold">ログイン</h1>
          <p class="text-xs text-muted">テナント: {{ tenantKey }}</p>
        </div>
      </template>

      <div class="space-y-4">
        <UFormField label="メールアドレス" required>
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="user@example.com"
            class="w-full"
            @keyup.enter="onSubmit"
          />
        </UFormField>

        <UFormField label="パスワード" required>
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="w-full"
            @keyup.enter="onSubmit"
          />
        </UFormField>

        <UButton block :loading="submitting" :disabled="!tenantKey" @click="onSubmit">
          ログイン
        </UButton>
      </div>
    </UCard>
  </div>
</template>
