<script setup lang="ts">
import { apiCreateUser, apiUpdateUser } from '~/api/users';
import type { User, UserRole } from '~/types/master';

const api = useApi();
const toast = useToast();

const props = defineProps<{
  open: boolean;
  user: User | null;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  saved: [User];
}>();

const draft = ref({
  email: '',
  name: '',
  password: '',
  role: 'member' as UserRole,
  resetPassword: false,
  projectIds: [] as string[],
});
const submitting = ref(false);
const { errors, clearField, clear: clearErrors, setFromApiError } = useFormErrors();

const isEdit = computed(() => Boolean(props.user));

// 閲覧できるプロジェクトの設定用。この画面は admin 専用なので一覧は全件返ってくる。
const { data: projects } = await useProjects();
const projectItems = computed(() =>
  projects.value
    .filter((p) => !p.archivedAt || draft.value.projectIds.includes(p.id))
    .map((p) => ({ value: p.id, label: p.archivedAt ? `${p.name}（アーカイブ済み）` : p.name })),
);

// admin はこの設定に関係なく全プロジェクトを閲覧できるため、選択させない
const projectsLocked = computed(() => draft.value.role === 'admin');

const selectedProjectNames = computed(() =>
  draft.value.projectIds.map(
    (id) => projectItems.value.find((i) => i.value === id)?.label ?? '(削除済み)',
  ),
);

const selectAllProjects = () => {
  draft.value.projectIds = projectItems.value.map((i) => i.value);
};

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    clearErrors();
    if (props.user) {
      draft.value = {
        email: props.user.email,
        name: props.user.name,
        password: '',
        role: props.user.role,
        resetPassword: false,
        // この画面は admin 専用なので projectIds は必ず返ってくる
        projectIds: [...(props.user.projectIds ?? [])],
      };
    } else {
      draft.value = {
        email: '',
        name: '',
        password: '',
        role: 'member',
        resetPassword: false,
        projectIds: [],
      };
    }
  },
);

const canSubmit = computed(() => {
  if (isEdit.value) {
    return Boolean(draft.value.name.trim());
  }
  return Boolean(
    draft.value.email.trim() && draft.value.name.trim() && draft.value.password.length >= 8,
  );
});

const roleItems = USER_ROLES.map((value) => ({
  value,
  label: `${USER_ROLE_LABEL[value]} (${value})`,
}));

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  clearErrors();
  try {
    let result: User;
    // admin は設定に関係なく全件見られるので、選択内容はそのまま保存する（役割を戻したときに復元される）
    if (props.user) {
      const patch: Record<string, unknown> = {
        name: draft.value.name.trim(),
        role: draft.value.role,
        projectIds: draft.value.projectIds,
      };
      if (draft.value.resetPassword && draft.value.password.length >= 8) {
        patch.password = draft.value.password;
      }
      result = await apiUpdateUser(api, props.user.id, patch);
    } else {
      result = await apiCreateUser(api, {
        email: draft.value.email.trim(),
        name: draft.value.name.trim(),
        password: draft.value.password,
        role: draft.value.role,
        projectIds: draft.value.projectIds,
      });
    }
    emit('saved', result);
    emit('update:open', false);
  } catch (e: unknown) {
    setFromApiError(e);
    if (Object.keys(errors.value).length === 0) {
      const data =
        typeof e === 'object' && e !== null && 'data' in e
          ? ((e as { data?: { message?: string | string[] } }).data ?? {})
          : {};
      const msg = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? 'ユーザーの保存に失敗しました');
      toast.add({ title: msg, color: 'error' });
    }
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <AppModal
    :open="open"
    :title="isEdit ? 'ユーザーを編集' : '新規ユーザー'"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="メールアドレス" required :error="errors.email">
          <UInput
            v-model="draft.email"
            type="email"
            placeholder="user@example.com"
            class="w-full"
            :disabled="isEdit"
            @update:model-value="clearField('email')"
          />
        </UFormField>
        <UFormField label="名前" required :error="errors.name">
          <UInput
            v-model="draft.name"
            placeholder="表示名"
            class="w-full"
            @update:model-value="clearField('name')"
          />
        </UFormField>
        <UFormField label="ロール" :error="errors.role">
          <SelectMenu
            :items="roleItems"
            :current="draft.role"
            default-icon="i-lucide-shield"
            @select="(c: string | null) => c && (draft.role = c as UserRole)"
          >
            <UButton
              color="neutral"
              variant="outline"
              block
              class="justify-between"
              trailing-icon="i-lucide-chevrons-up-down"
            >
              {{ USER_ROLE_LABEL[draft.role] }} ({{ draft.role }})
            </UButton>
          </SelectMenu>
        </UFormField>

        <UFormField
          label="閲覧できるプロジェクト"
          :hint="projectsLocked ? '管理者はすべて閲覧できます' : '選んだプロジェクトだけ見えます'"
          :error="errors.projectIds"
        >
          <div class="space-y-1">
            <USelectMenu
              v-model="draft.projectIds"
              :items="projectItems"
              value-key="value"
              multiple
              :disabled="projectsLocked"
              class="w-full"
            >
              <!-- 既定のトリガーは選択名を全部並べるため、件数が増えると崩れる。
                   先頭 2 件 + 他 N 件に畳み、全件はホバー（title）で見せる。 -->
              <template #default>
                <span v-if="projectsLocked" class="truncate text-dimmed">
                  すべてのプロジェクト
                </span>
                <span v-else-if="selectedProjectNames.length === 0" class="truncate text-dimmed">
                  プロジェクトを選択
                </span>
                <span v-else class="truncate" :title="namesTitle(selectedProjectNames)">
                  {{ summarizeNames(selectedProjectNames) }}
                </span>
              </template>
            </USelectMenu>
            <div v-if="!projectsLocked" class="flex items-center gap-1">
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                label="すべて選択"
                :disabled="draft.projectIds.length === projectItems.length"
                @click="selectAllProjects"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                label="クリア"
                :disabled="draft.projectIds.length === 0"
                @click="draft.projectIds = []"
              />
              <span class="ml-auto text-xs text-muted">
                {{ draft.projectIds.length }} / {{ projectItems.length }} 件
              </span>
            </div>
          </div>
        </UFormField>

        <template v-if="isEdit">
          <UCheckbox v-model="draft.resetPassword" label="パスワードを再発行する" />
          <UFormField
            v-if="draft.resetPassword"
            label="新しいパスワード"
            hint="8〜72 文字"
            required
            :error="errors.password"
          >
            <UInput
              v-model="draft.password"
              type="password"
              autocomplete="new-password"
              class="w-full"
              @update:model-value="clearField('password')"
            />
          </UFormField>
        </template>
        <template v-else>
          <UFormField label="初期パスワード" hint="8〜72 文字" required :error="errors.password">
            <UInput
              v-model="draft.password"
              type="password"
              autocomplete="new-password"
              class="w-full"
              @update:model-value="clearField('password')"
            />
          </UFormField>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          label="キャンセル"
          @click="emit('update:open', false)"
        />
        <UButton
          color="primary"
          :loading="submitting"
          :disabled="!canSubmit"
          :label="isEdit ? '保存' : '追加'"
          @click="submit"
        />
      </div>
    </template>
  </AppModal>
</template>
