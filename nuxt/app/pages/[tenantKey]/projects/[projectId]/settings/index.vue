<script setup lang="ts">
import { updateProject } from '~/api/projects';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);

const { data: projects, refresh: refreshProjects } = await useProjects();
const project = computed(() => projects.value.find((p) => p.id === projectId.value));

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
      await updateProject(projectId.value, { name: trimmed });
      await refreshProjects();
    }
  } else if (field === 'description') {
    const next = value.trim() || null;
    if (next !== project.value.description) {
      await updateProject(projectId.value, { description: next });
      await refreshProjects();
    }
  }
  editingField.value = null;
};

const cancelEdit = () => {
  cancelling.value = true;
  editingField.value = null;
};

const archiveModalOpen = ref(false);
const archiving = ref(false);

const performArchive = async () => {
  if (!project.value) return;
  archiving.value = true;
  try {
    await updateProject(projectId.value, { archivedAt: new Date().toISOString().slice(0, 19) });
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

    <UModal
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
    </UModal>
  </div>
</template>
