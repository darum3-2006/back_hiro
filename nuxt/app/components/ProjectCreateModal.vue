<script setup lang="ts">
import { createProject } from '~/api/projects';
import type { Project } from '~/types/project';

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

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      draft.value = { name: '', key: '', description: '' };
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

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    const project = await createProject({
      name: draft.value.name.trim(),
      key: normalizedKey.value,
      description: draft.value.description.trim() || null,
    });
    emit('created', project);
    emit('update:open', false);
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
        <UFormField label="名前" required>
          <UInput v-model="draft.name" placeholder="プロジェクト名" autofocus class="w-full" />
        </UFormField>
        <UFormField
          label="Key"
          hint="識別子（大文字英数）"
          required
          :error="keyConflict ? `「${normalizedKey}」は既に使われています` : undefined"
        >
          <UInput v-model="draft.key" placeholder="MYPROJECT" class="w-full" />
        </UFormField>
        <UFormField label="説明">
          <UTextarea
            v-model="draft.description"
            :rows="3"
            autoresize
            placeholder="任意"
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
          label="作成"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
