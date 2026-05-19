<script setup lang="ts">
import { apiChangePassword } from '~/api/auth';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
}>();

const api = useApi();
const toast = useToast();
const { errors, clearField, clear: clearErrors, setFromApiError } = useFormErrors();

const draft = ref({
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
});
const submitting = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    draft.value = { currentPassword: '', newPassword: '', confirmNewPassword: '' };
    clearErrors();
  },
);

const confirmMismatch = computed(
  () =>
    draft.value.confirmNewPassword.length > 0 &&
    draft.value.newPassword !== draft.value.confirmNewPassword,
);

const canSubmit = computed(
  () =>
    draft.value.currentPassword.length >= 1 &&
    draft.value.newPassword.length >= 8 &&
    draft.value.newPassword === draft.value.confirmNewPassword,
);

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  clearErrors();
  try {
    await apiChangePassword(api, {
      currentPassword: draft.value.currentPassword,
      newPassword: draft.value.newPassword,
    });
    emit('update:open', false);
    toast.add({
      title: 'パスワードを変更しました',
      color: 'success',
      icon: 'i-lucide-check',
    });
  } catch (e: unknown) {
    setFromApiError(e);
    if (Object.keys(errors.value).length === 0) {
      const data =
        typeof e === 'object' && e !== null && 'data' in e
          ? ((e as { data?: { message?: string | string[] } }).data ?? {})
          : {};
      const msg = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? 'パスワードの変更に失敗しました');
      toast.add({ title: msg, color: 'error' });
    }
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <UModal :open="open" title="パスワード変更" @update:open="(v: boolean) => emit('update:open', v)">
    <template #body>
      <div class="space-y-4">
        <UFormField label="現在のパスワード" required :error="errors.currentPassword">
          <UInput
            v-model="draft.currentPassword"
            type="password"
            autocomplete="current-password"
            class="w-full"
            @update:model-value="clearField('currentPassword')"
          />
        </UFormField>

        <UFormField label="新しいパスワード" hint="8〜72 文字" required :error="errors.newPassword">
          <UInput
            v-model="draft.newPassword"
            type="password"
            autocomplete="new-password"
            class="w-full"
            @update:model-value="clearField('newPassword')"
          />
        </UFormField>

        <UFormField
          label="新しいパスワード（確認）"
          required
          :error="confirmMismatch ? 'パスワードが一致しません' : undefined"
        >
          <UInput
            v-model="draft.confirmNewPassword"
            type="password"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>
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
          label="変更"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
