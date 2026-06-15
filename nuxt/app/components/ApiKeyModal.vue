<script setup lang="ts">
import { apiGetApiKey, apiRegenerateApiKey, apiRevokeApiKey, type ApiKeyInfo } from '~/api/api-key';
import { fmtDateTime } from '~/utils/date';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
}>();

const api = useApi();
const toast = useToast();

const info = ref<ApiKeyInfo | null>(null);
const loading = ref(false);
const working = ref(false);
/** 発行直後にのみ表示する平文キー（モーダルを閉じる/再取得でクリア）。 */
const issuedKey = ref<string | null>(null);
const confirmRegenerate = ref(false);

const loadInfo = async () => {
  loading.value = true;
  try {
    info.value = await apiGetApiKey(api);
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      issuedKey.value = null;
      confirmRegenerate.value = false;
      return;
    }
    info.value = null;
    issuedKey.value = null;
    confirmRegenerate.value = false;
    void loadInfo();
  },
);

const regenerate = async () => {
  working.value = true;
  try {
    const result = await apiRegenerateApiKey(api);
    issuedKey.value = result.apiKey;
    confirmRegenerate.value = false;
    await loadInfo();
  } finally {
    working.value = false;
  }
};

const revoke = async () => {
  working.value = true;
  try {
    await apiRevokeApiKey(api);
    issuedKey.value = null;
    await loadInfo();
    toast.add({ title: 'APIキーを失効しました', color: 'success', icon: 'i-lucide-check' });
  } finally {
    working.value = false;
  }
};

const copyKey = async () => {
  if (!issuedKey.value) return;
  await navigator.clipboard.writeText(issuedKey.value);
  toast.add({ title: 'コピーしました', color: 'success', icon: 'i-lucide-copy' });
};
</script>

<template>
  <UModal
    :open="open"
    title="公開API キー"
    description="公開API（/api/v1）の認証に使うキーです。Authorization: Bearer ヘッダに指定します。"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4 text-sm">
        <!-- 発行直後のみ平文を表示 -->
        <div v-if="issuedKey" class="space-y-2">
          <p class="text-success font-medium">新しいキーを発行しました</p>
          <div class="flex items-center gap-2">
            <code class="flex-1 break-all rounded bg-elevated/60 px-2 py-1 font-mono text-xs">{{
              issuedKey
            }}</code>
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="soft"
              size="sm"
              @click="copyKey"
            />
          </div>
          <p class="text-warning text-xs">
            このキーはこの画面でのみ表示されます。安全な場所に保管してください（再表示できません）。
          </p>
        </div>

        <div v-if="loading" class="text-muted">読み込み中…</div>
        <template v-else-if="info">
          <div v-if="info.issued" class="space-y-1">
            <p class="text-muted text-xs">発行済み</p>
            <p>
              プレフィックス:
              <code class="font-mono">{{ info.prefix }}…</code>
            </p>
            <p v-if="info.createdAt" class="text-muted text-xs">
              発行日時: {{ fmtDateTime(info.createdAt) }}
            </p>
          </div>
          <p v-else class="text-muted">まだAPIキーは発行されていません。</p>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton
          v-if="info?.issued"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          label="失効"
          :loading="working"
          @click="revoke"
        />
        <div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="閉じる"
            @click="emit('update:open', false)"
          />
          <template v-if="info?.issued && !confirmRegenerate">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-refresh-cw"
              label="再生成"
              @click="confirmRegenerate = true"
            />
          </template>
          <template v-else-if="confirmRegenerate">
            <UButton
              color="warning"
              icon="i-lucide-refresh-cw"
              label="再生成する（旧キー失効）"
              :loading="working"
              @click="regenerate"
            />
          </template>
          <UButton
            v-else
            color="primary"
            icon="i-lucide-plus"
            label="発行"
            :loading="working"
            @click="regenerate"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
