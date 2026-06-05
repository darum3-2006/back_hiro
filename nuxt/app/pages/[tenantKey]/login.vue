<script setup lang="ts">
definePageMeta({ layout: 'blank' });

const route = useRoute();
const tenantKey = computed(() => (route.params.tenantKey as string | undefined) ?? '');

const { login, loginWithGoogle, token, fetchMe } = useAuth();
const toast = useToast();

const email = ref('');
const password = ref('');
const submitting = ref(false);

// ===== Google SSO =====
interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleGsi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (res: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

const googleClientId = useRuntimeConfig().public.googleClientId;
const googleButtonEl = ref<HTMLElement | null>(null);

// GIS スクリプトを読み込む（CSR のみなので head に注入で十分）
useHead({
  script: [{ src: 'https://accounts.google.com/gsi/client', async: true, defer: true }],
});

const waitForGoogle = async (): Promise<GoogleGsi | null> => {
  for (let i = 0; i < 50; i++) {
    const g = (window as unknown as { google?: GoogleGsi }).google;
    if (g?.accounts?.id) return g;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
};

const onGoogleCredential = async (res: GoogleCredentialResponse) => {
  if (!tenantKey.value || !res.credential) return;
  submitting.value = true;
  try {
    await loginWithGoogle({ tenantKey: tenantKey.value, idToken: res.credential });
    window.location.href = resolveRedirect();
  } catch (e: unknown) {
    submitting.value = false;
    const message =
      typeof e === 'object' && e !== null && 'data' in e
        ? ((e as { data?: { message?: string } }).data?.message ?? 'Google ログインに失敗しました')
        : 'Google ログインに失敗しました';
    toast.add({ title: message, color: 'error' });
  }
};

const setupGoogleButton = async () => {
  if (!googleClientId || !tenantKey.value) return;
  const g = await waitForGoogle();
  if (!g || !googleButtonEl.value) return;
  g.accounts.id.initialize({ client_id: googleClientId, callback: onGoogleCredential });
  g.accounts.id.renderButton(googleButtonEl.value, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    locale: 'ja',
    width: 300,
  });
};

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
// 未ログインなら Google ボタンを描画する。
onMounted(async () => {
  if (token.value) {
    const me = await fetchMe();
    if (me) {
      await navigateTo(resolveRedirect(), { replace: true });
      return;
    }
  }
  await setupGoogleButton();
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

        <div v-if="googleClientId" class="flex items-center gap-3 text-xs text-muted">
          <span class="h-px flex-1 bg-default" />
          または
          <span class="h-px flex-1 bg-default" />
        </div>

        <!-- Google Identity Services がこの要素にボタンを描画する -->
        <div v-if="googleClientId" ref="googleButtonEl" class="flex justify-center" />
      </div>
    </UCard>
  </div>
</template>
