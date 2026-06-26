<script setup lang="ts">
import { apiTestSlack, apiUpdateProject } from '~/api/projects';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);

const api = useApi();
const toast = useToast();
const { data: projects, refresh: refreshProjects } = await useProjects();
const { data: members } = await useMembers(projectId);
const project = computed(() => projects.value.find((p) => p.id === projectId.value));
const { me } = useAuth();
const currentUserId = useCurrentUserId();
const isAdmin = computed(() => me.value?.role === 'admin');

// Slack 設定はテナント管理者 or プロジェクト管理者のみ編集可
const canEditSlack = computed(
  () =>
    isAdmin.value ||
    members.value.some((m) => m.userId === currentUserId.value && m.role === 'admin'),
);

type EditableField = 'name' | 'description';
const editingField = ref<EditableField | null>(null);
const editBuffer = ref('');
const cancelling = ref(false);

const startEdit = (field: EditableField, current: string | null) => {
  editingField.value = field;
  editBuffer.value = current ?? '';
  cancelling.value = false;
};

const commitEdit = async () => {
  if (cancelling.value) {
    cancelling.value = false;
    editingField.value = null;
    return;
  }
  if (!editingField.value || !project.value) {
    editingField.value = null;
    return;
  }
  const field = editingField.value;
  const value = editBuffer.value;
  if (field === 'name') {
    const trimmed = value.trim();
    if (trimmed && trimmed !== project.value.name) {
      await apiUpdateProject(api, projectId.value, { name: trimmed });
      await refreshProjects();
    }
  } else if (field === 'description') {
    const next = value.trim() || null;
    if (next !== project.value.description) {
      await apiUpdateProject(api, projectId.value, { description: next });
      await refreshProjects();
    }
  }
  editingField.value = null;
};

const cancelEdit = () => {
  cancelling.value = true;
  editingField.value = null;
};

type HighlightField =
  | 'highlightOverdueDeadline'
  | 'highlightOverduePlannedStart'
  | 'highlightOverduePlannedCompletion'
  | 'highlightOverduePlannedRelease';

const highlightToggles: { field: HighlightField; label: string }[] = [
  { field: 'highlightOverdueDeadline', label: '期限超過の行を赤く強調する' },
  { field: 'highlightOverduePlannedStart', label: '着手予定日超過の行を赤く強調する' },
  { field: 'highlightOverduePlannedCompletion', label: '完了予定日超過の行を赤く強調する' },
  { field: 'highlightOverduePlannedRelease', label: 'リリース予定日超過の行を赤く強調する' },
];

const toggleHighlight = async (field: HighlightField, value: boolean) => {
  if (!project.value) return;
  await apiUpdateProject(api, projectId.value, { [field]: value });
  await refreshProjects();
};

// ===== Slack 通知 =====
const webhookInput = ref('');
const savingWebhook = ref(false);
const testingSlack = ref(false);

const saveWebhook = async () => {
  const value = webhookInput.value.trim();
  if (!value || savingWebhook.value) return;
  savingWebhook.value = true;
  try {
    await apiUpdateProject(api, projectId.value, { slackWebhookUrl: value });
    await refreshProjects();
    webhookInput.value = '';
    toast.add({ title: 'Slack Webhook を保存しました', color: 'success', icon: 'i-lucide-check' });
  } catch {
    toast.add({
      title: '保存に失敗しました',
      description:
        'Slack の Incoming Webhook URL（https://hooks.slack.com/services/…）を確認してください',
      color: 'error',
    });
  } finally {
    savingWebhook.value = false;
  }
};

const clearWebhook = async () => {
  savingWebhook.value = true;
  try {
    await apiUpdateProject(api, projectId.value, { slackWebhookUrl: null });
    await refreshProjects();
    webhookInput.value = '';
    toast.add({ title: 'Slack 連携を解除しました', color: 'success', icon: 'i-lucide-check' });
  } finally {
    savingWebhook.value = false;
  }
};

type SlackToggleField =
  | 'slackNotifyTaskCreated'
  | 'slackNotifyStatusChanged'
  | 'slackNotifyTaskCompleted';

const slackToggles: { field: SlackToggleField; label: string }[] = [
  { field: 'slackNotifyTaskCreated', label: '新しいタスクが登録されたとき' },
  { field: 'slackNotifyStatusChanged', label: 'ステータスが変わったとき（完了を除く）' },
  { field: 'slackNotifyTaskCompleted', label: 'タスクが完了したとき' },
];

const toggleSlack = async (field: SlackToggleField, value: boolean) => {
  if (!project.value) return;
  await apiUpdateProject(api, projectId.value, { [field]: value });
  await refreshProjects();
};

const sendTestSlack = async () => {
  testingSlack.value = true;
  try {
    await apiTestSlack(api, projectId.value);
    toast.add({
      title: 'Slack へテスト通知を送りました',
      color: 'success',
      icon: 'i-lucide-check',
    });
  } catch {
    toast.add({
      title: 'テスト送信に失敗しました',
      description: 'Webhook URL が正しいか確認してください',
      color: 'error',
    });
  } finally {
    testingSlack.value = false;
  }
};

const archiveModalOpen = ref(false);
const archiving = ref(false);

const performArchive = async () => {
  if (!project.value) return;
  archiving.value = true;
  try {
    await apiUpdateProject(api, projectId.value, { archived: true });
    await refreshProjects();
    archiveModalOpen.value = false;
    // app.vue の watchEffect で自動的に別の有効プロジェクトへ遷移
  } finally {
    archiving.value = false;
  }
};
</script>

<template>
  <div v-if="project" class="p-6 space-y-6 max-w-2xl">
    <div>
      <p class="text-xs text-muted mb-1">名前</p>
      <UInput
        v-if="editingField === 'name'"
        v-model="editBuffer"
        autofocus
        class="w-full"
        @blur="commitEdit"
        @keydown.enter.prevent="commitEdit"
        @keydown.escape.prevent="cancelEdit"
      />
      <button
        v-else
        class="text-base font-medium text-left w-full hover:bg-elevated/40 rounded px-1 -mx-1"
        @click="startEdit('name', project.name)"
      >
        {{ project.name }}
      </button>
    </div>

    <div>
      <p class="text-xs text-muted mb-1">Key</p>
      <code class="text-sm font-mono text-muted">{{ project.key }}</code>
    </div>

    <div>
      <p class="text-xs text-muted mb-1">説明</p>
      <UTextarea
        v-if="editingField === 'description'"
        v-model="editBuffer"
        autofocus
        :rows="3"
        autoresize
        class="w-full"
        @blur="commitEdit"
        @keydown.escape.prevent="cancelEdit"
      />
      <button
        v-else
        class="text-sm whitespace-pre-wrap text-left w-full hover:bg-elevated/40 rounded px-1 -mx-1 min-h-6"
        @click="startEdit('description', project.description)"
      >
        <span v-if="project.description">{{ project.description }}</span>
        <span v-else class="text-muted">クリックして説明を追加</span>
      </button>
    </div>

    <USeparator />

    <div>
      <h3 class="text-sm font-medium mb-3">表示設定</h3>
      <div class="space-y-3">
        <USwitch
          v-for="t in highlightToggles"
          :key="t.field"
          :model-value="project[t.field]"
          :label="t.label"
          @update:model-value="(v: boolean) => toggleHighlight(t.field, v)"
        />
      </div>
    </div>

    <template v-if="canEditSlack">
      <USeparator />

      <div>
        <h3 class="text-sm font-medium mb-1">Slack 通知</h3>
        <p class="text-sm text-muted mb-3">
          プロジェクトの Incoming Webhook を設定すると、選んだイベントを Slack に通知します。
        </p>

        <div class="space-y-2 mb-4">
          <p class="text-xs text-muted">Webhook URL</p>
          <div v-if="project.slackWebhookConfigured" class="flex items-center gap-2">
            <UBadge color="success" variant="subtle" icon="i-lucide-check" label="設定済み" />
            <UButton
              color="primary"
              variant="soft"
              size="sm"
              icon="i-lucide-send"
              label="テスト送信"
              :loading="testingSlack"
              @click="sendTestSlack"
            />
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              label="解除"
              :loading="savingWebhook"
              @click="clearWebhook"
            />
          </div>
          <div class="flex items-center gap-2">
            <UInput
              v-model="webhookInput"
              type="url"
              class="flex-1"
              :placeholder="
                project.slackWebhookConfigured
                  ? '再入力で変更（https://hooks.slack.com/services/…）'
                  : 'https://hooks.slack.com/services/…'
              "
              @keydown.enter.prevent="saveWebhook"
            />
            <UButton
              color="neutral"
              label="保存"
              :loading="savingWebhook"
              :disabled="!webhookInput.trim()"
              @click="saveWebhook"
            />
          </div>
        </div>

        <p class="text-xs text-muted mb-2">通知するイベント</p>
        <div class="space-y-3">
          <USwitch
            v-for="t in slackToggles"
            :key="t.field"
            :model-value="project[t.field]"
            :label="t.label"
            :disabled="!project.slackWebhookConfigured"
            @update:model-value="(v: boolean) => toggleSlack(t.field, v)"
          />
        </div>
      </div>
    </template>

    <template v-if="isAdmin">
      <USeparator />

      <div>
        <h3 class="text-sm font-medium mb-2">アーカイブ</h3>
        <p class="text-sm text-muted mb-3">
          アーカイブするとサイドバーから非表示になり、新規タスクの作成もできなくなります。プロジェクト一覧から復元できます。
        </p>
        <UButton
          color="error"
          variant="soft"
          icon="i-lucide-archive"
          label="アーカイブする"
          @click="archiveModalOpen = true"
        />
      </div>
    </template>

    <AppModal
      v-model:open="archiveModalOpen"
      title="プロジェクトをアーカイブ"
      :description="`「${project.name}」をアーカイブしますか？`"
    >
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="キャンセル"
            @click="archiveModalOpen = false"
          />
          <UButton
            color="error"
            :loading="archiving"
            icon="i-lucide-archive"
            label="アーカイブ"
            @click="performArchive"
          />
        </div>
      </template>
    </AppModal>
  </div>
</template>
