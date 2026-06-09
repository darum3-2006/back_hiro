<script setup lang="ts">
import { apiCreateDepartment, apiUpdateDepartment } from '~/api/masters';
import type { Department } from '~/types/master';

const api = useApi();
const toast = useToast();

const props = defineProps<{
  open: boolean;
  department: Department | null;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  saved: [Department];
}>();

const draft = ref({ code: '', name: '' });
const submitting = ref(false);
const { errors, clearField, clear: clearErrors, setFromApiError } = useFormErrors();

const isEdit = computed(() => Boolean(props.department));

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    clearErrors();
    draft.value = props.department
      ? { code: props.department.code, name: props.department.name }
      : { code: '', name: '' };
  },
);

const canSubmit = computed(() =>
  isEdit.value
    ? Boolean(draft.value.name.trim())
    : Boolean(draft.value.code.trim() && draft.value.name.trim()),
);

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  clearErrors();
  try {
    let result: Department;
    if (props.department) {
      result = await apiUpdateDepartment(api, props.department.code, {
        name: draft.value.name.trim(),
      });
    } else {
      result = await apiCreateDepartment(api, {
        code: draft.value.code.trim(),
        name: draft.value.name.trim(),
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
        : (data.message ?? '部署の保存に失敗しました');
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
    :title="isEdit ? '部署を編集' : '新規部署'"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="コード" hint="識別子（作成後は変更不可）" required :error="errors.code">
          <UInput
            v-model="draft.code"
            placeholder="SALES"
            class="w-full"
            :disabled="isEdit"
            @update:model-value="clearField('code')"
          />
        </UFormField>
        <UFormField label="部署名" required :error="errors.name">
          <UInput
            v-model="draft.name"
            placeholder="営業部"
            class="w-full"
            @update:model-value="clearField('name')"
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
          :label="isEdit ? '保存' : '追加'"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
