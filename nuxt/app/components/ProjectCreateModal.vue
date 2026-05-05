<script setup lang="ts">
import { apiCreateProject } from '~/api/projects';
import type { Project } from '~/types/project';

const api = useApi();

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  created: [Project];
}>();

const { data: projects } = await useProjects();

const draft = ref({ name: '', key: '', description: '' });
const submitting = ref(false);
const { errors, clearField, clear: clearErrors, setFromApiError } = useFormErrors();

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      draft.value = { name: '', key: '', description: '' };
      clearErrors();
    }
  },
);

const normalizedKey = computed(() => draft.value.key.trim().toUpperCase());

const existingKeys = computed(() => new Set(projects.value.map((p) => p.key.toUpperCase())));

const keyConflict = computed(
  () => Boolean(normalizedKey.value) && existingKeys.value.has(normalizedKey.value),
);

const canSubmit = computed(() =>
  Boolean(draft.value.name.trim() && normalizedKey.value && !keyConflict.value),
);

const toast = useToast();

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  clearErrors();
  try {
    const project = await apiCreateProject(api, {
      name: draft.value.name.trim(),
      key: normalizedKey.value,
      description: draft.value.description.trim() || null,
    });
    emit('created', project);
    emit('update:open', false);
  } catch (e: unknown) {
    setFromApiError(e);
    if (Object.keys(errors.value).length === 0) {
      // フィールドにマップできない一般エラー（409 など）は toast で
      const data =
        typeof e === 'object' && e !== null && 'data' in e
          ? ((e as { data?: { message?: string | string[] } }).data ?? {})
          : {};
      const msg = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? 'プロジェクトの作成に失敗しました');
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
    title="新規プロジェクト"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="名前" required :error="errors.name">
          <UInput
            v-model="draft.name"
            placeholder="プロジェクト名"
            autofocus
            class="w-full"
            @update:model-value="clearField('name')"
          />
        </UFormField>
        <UFormField
          label="Key"
          hint="識別子（大文字英数）"
          required
          :error="
            keyConflict ? `「${normalizedKey}」は既に使われています` : (errors.key ?? undefined)
          "
        >
          <UInput
            v-model="draft.key"
            placeholder="MYPROJECT"
            class="w-full"
            @update:model-value="clearField('key')"
          />
        </UFormField>
        <UFormField label="説明" :error="errors.description">
          <UTextarea
            v-model="draft.description"
            :rows="3"
            autoresize
            placeholder="任意"
            class="w-full"
            @update:model-value="clearField('description')"
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
          label="作成"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
