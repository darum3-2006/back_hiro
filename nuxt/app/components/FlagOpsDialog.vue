<script setup lang="ts">
import {
  apiCopyFlag,
  apiDetachFlagFromAllTasks,
  apiMoveFlag,
  countFlagReferences,
} from '~/api/masters';
import type { Flag } from '~/types/master';

const props = defineProps<{
  open: boolean;
  projectId: string;
  flags: Flag[];
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  /** 操作が完了してタスクの紐付けが変わったとき（親で一覧を再取得する用） */
  done: [];
}>();

const api = useApi();
const toast = useToast();

type Op = 'copy' | 'move' | 'detach';

const sourceCode = ref<string | undefined>(undefined);
const op = ref<Op>('copy');
const targetCode = ref<string | undefined>(undefined);
const references = ref<{ tasks: number; subtasks: number } | null>(null);
const loadingReferences = ref(false);
const running = ref(false);

const flagItems = computed(() => props.flags.map((f) => ({ label: f.name, value: f.code })));
const targetItems = computed(() =>
  props.flags
    .filter((f) => f.code !== sourceCode.value)
    .map((f) => ({ label: f.name, value: f.code })),
);
const opItems = [
  { label: 'コピー（別フラグを追加）', value: 'copy' as const },
  { label: '移動（別フラグへ付け替え）', value: 'move' as const },
  { label: '全タスクから外す', value: 'detach' as const },
];

const needsTarget = computed(() => op.value === 'copy' || op.value === 'move');
const sourceFlag = computed(() => props.flags.find((f) => f.code === sourceCode.value) ?? null);

// 開くたびに初期化
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    sourceCode.value = undefined;
    op.value = 'copy';
    targetCode.value = undefined;
    references.value = null;
  },
);

// 元フラグを選んだら対象タスク件数を引く
watch(sourceCode, async (code) => {
  targetCode.value = undefined;
  references.value = null;
  if (!code) return;
  loadingReferences.value = true;
  try {
    references.value = await countFlagReferences(api, props.projectId, code);
  } finally {
    loadingReferences.value = false;
  }
});

const canRun = computed(() => {
  if (!sourceCode.value || running.value) return false;
  if ((references.value?.tasks ?? 0) + (references.value?.subtasks ?? 0) === 0) return false;
  if (needsTarget.value && !targetCode.value) return false;
  return true;
});

const run = async () => {
  if (!canRun.value || !sourceCode.value) return;
  running.value = true;
  const sourceName = sourceFlag.value?.name ?? '';
  const targetName = props.flags.find((f) => f.code === targetCode.value)?.name ?? '';
  try {
    if (op.value === 'copy') {
      await apiCopyFlag(api, props.projectId, sourceCode.value, targetCode.value!);
      toast.add({
        title: 'フラグをコピーしました',
        description: `${sourceName} → ${targetName}`,
        color: 'success',
        icon: 'i-lucide-check',
      });
    } else if (op.value === 'move') {
      await apiMoveFlag(api, props.projectId, sourceCode.value, targetCode.value!);
      toast.add({
        title: 'フラグを移動しました',
        description: `${sourceName} → ${targetName}`,
        color: 'success',
        icon: 'i-lucide-check',
      });
    } else {
      await apiDetachFlagFromAllTasks(api, props.projectId, sourceCode.value);
      toast.add({
        title: 'フラグを全タスクから外しました',
        description: sourceName,
        color: 'success',
        icon: 'i-lucide-check',
      });
    }
    emit('done');
    emit('update:open', false);
  } finally {
    running.value = false;
  }
};
</script>

<template>
  <AppModal
    :open="open"
    title="フラグ操作"
    description="元フラグが付いた全タスクに対して、別フラグの追加・付け替え・解除をまとめて行います。"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4 text-sm">
        <div>
          <p class="text-xs text-muted mb-1">元フラグ</p>
          <USelectMenu
            v-model="sourceCode"
            :items="flagItems"
            value-key="value"
            placeholder="フラグを選択…"
            searchable
            search-placeholder="フラグ名で検索…"
            class="w-full"
          />
          <p v-if="loadingReferences" class="text-xs text-muted mt-1">対象を確認中…</p>
          <p v-else-if="references" class="text-xs text-muted mt-1">
            対象タスク: {{ references.tasks }} 件・サブタスク: {{ references.subtasks }} 件
          </p>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">操作</p>
          <URadioGroup v-model="op" :items="opItems" />
        </div>

        <div v-if="needsTarget">
          <p class="text-xs text-muted mb-1">{{ op === 'copy' ? 'コピー' : '移動' }}先フラグ</p>
          <USelectMenu
            v-model="targetCode"
            :items="targetItems"
            value-key="value"
            placeholder="フラグを選択…"
            searchable
            search-placeholder="フラグ名で検索…"
            class="w-full"
          />
        </div>
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
        <UButton color="primary" :loading="running" :disabled="!canRun" label="実行" @click="run" />
      </div>
    </template>
  </AppModal>
</template>
