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
});
const submitting = ref(false);
const { errors, clearField, clear: clearErrors, setFromApiError } = useFormErrors();

const isEdit = computed(() => Boolean(props.user));

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
      };
    } else {
      draft.value = { email: '', name: '', password: '', role: 'member', resetPassword: false };
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

const roleItems = [
  { value: 'admin', label: '管理者 (admin)' },
  { value: 'member', label: '通常 (member)' },
];

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  clearErrors();
  try {
    let result: User;
    if (props.user) {
      const patch: Record<string, unknown> = {
        name: draft.value.name.trim(),
        role: draft.value.role,
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
  <UModal
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
              {{ draft.role === 'admin' ? '管理者 (admin)' : '通常 (member)' }}
            </UButton>
          </SelectMenu>
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
  </UModal>
</template>
