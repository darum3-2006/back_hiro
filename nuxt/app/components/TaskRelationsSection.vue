<script setup lang="ts">
import { apiCreateTaskRelation, apiDeleteTaskRelation } from '~/api/relations';
import type { TaskStatus } from '~/types/master';
import type { RelationKind, TaskRelationView } from '~/types/relation';
import type { Task } from '~/types/task';

const props = defineProps<{
  projectId: string;
  taskId: string;
  /** 関連づけ候補・#seq リンク用の同プロジェクト全タスク */
  tasks: Task[];
  statusMap: Record<string, TaskStatus>;
}>();

const emit = defineEmits<{
  /** 関連に変更があった（ガント等で再取得する用） */
  changed: [];
}>();

const api = useApi();

// readonly（閲覧のみ）ユーザーには編集 UI を出さない（API 側でも 403 で拒否される）
const { isReadonly } = useAuth();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const projectIdRef = computed(() => props.projectId);
const taskIdRef = computed<string | null>(() => props.taskId || null);
const { data: relations, refresh } = useTaskRelations(projectIdRef, taskIdRef);

// 表示グループ（順序も兼ねる）
const GROUPS: { kind: RelationKind; label: string; icon: string }[] = [
  { kind: 'predecessor', label: '先行タスク', icon: 'i-lucide-arrow-left-to-line' },
  { kind: 'successor', label: '後続タスク', icon: 'i-lucide-arrow-right-to-line' },
  { kind: 'blocks', label: 'ブロックしている', icon: 'i-lucide-octagon-x' },
  { kind: 'blocked_by', label: 'ブロックされている', icon: 'i-lucide-octagon-alert' },
  { kind: 'related', label: '関連', icon: 'i-lucide-link' },
];

const grouped = computed(() =>
  GROUPS.map((g) => ({
    ...g,
    items: relations.value.filter((r) => r.kind === g.kind),
  })).filter((g) => g.items.length > 0),
);

const openOther = (r: TaskRelationView) => {
  void router.replace({ query: { ...route.query, task: String(r.otherSeq) } });
};

// ===== 追加フォーム =====
const KIND_ITEMS: { value: RelationKind; label: string }[] = [
  { value: 'related', label: '関連' },
  { value: 'successor', label: '後続（このタスクの後）' },
  { value: 'predecessor', label: '先行（このタスクの前）' },
  { value: 'blocks', label: 'ブロックする' },
  { value: 'blocked_by', label: 'ブロックされる' },
];
const adding = ref(false);
const newKind = ref<RelationKind>('related');
const newOtherId = ref<string | undefined>(undefined);
const saving = ref(false);

// 自分自身を除いた候補（#seq タイトル）
const taskItems = computed(() =>
  props.tasks
    .filter((t) => t.id !== props.taskId)
    .map((t) => ({ value: t.id, label: `#${t.seq} ${t.content}` })),
);
const kindLabel = computed(() => KIND_ITEMS.find((k) => k.value === newKind.value)?.label ?? '');

const resetForm = () => {
  adding.value = false;
  newKind.value = 'related';
  newOtherId.value = undefined;
};

const addRelation = async () => {
  if (!newOtherId.value || saving.value) return;
  saving.value = true;
  try {
    await apiCreateTaskRelation(api, props.projectId, props.taskId, {
      otherTaskId: newOtherId.value,
      kind: newKind.value,
    });
    resetForm();
    await refresh();
    emit('changed');
  } catch (e) {
    const msg = (e as { data?: { message?: string } })?.data?.message;
    toast.add({ title: msg ?? '関連づけに失敗しました', color: 'error' });
  } finally {
    saving.value = false;
  }
};

const removeRelation = async (r: TaskRelationView) => {
  try {
    await apiDeleteTaskRelation(api, props.projectId, props.taskId, r.id);
    await refresh();
    emit('changed');
  } catch {
    toast.add({ title: '関連の解除に失敗しました', color: 'error' });
  }
};
</script>

<template>
  <CollapsibleSection title="関連タスク" icon="i-lucide-waypoints">
    <template #trailing>
      <span v-if="relations.length > 0" class="text-xs text-muted">{{ relations.length }}</span>
    </template>

    <div v-if="grouped.length === 0 && !adding" class="text-xs text-muted mb-2">
      関連づけされたタスクはありません。
    </div>

    <div v-for="g in grouped" :key="g.kind" class="mb-2">
      <p class="mb-1 flex items-center gap-1 text-xs text-muted">
        <UIcon :name="g.icon" class="size-3.5" />
        {{ g.label }}
      </p>
      <div class="space-y-1">
        <div
          v-for="r in g.items"
          :key="r.id"
          class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-elevated/40"
        >
          <button
            class="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:underline"
            @click="openOther(r)"
          >
            <span class="shrink-0 font-mono text-xs text-muted">#{{ r.otherSeq }}</span>
            <span class="truncate text-sm">{{ r.otherContent }}</span>
            <UBadge
              v-if="statusMap[r.otherStatusCode]"
              :color="statusMap[r.otherStatusCode]!.color"
              variant="subtle"
              size="xs"
              :label="statusMap[r.otherStatusCode]!.label"
              class="shrink-0"
            />
          </button>
          <UButton
            v-if="!isReadonly"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            class="opacity-0 group-hover:opacity-100"
            :aria-label="`関連を解除`"
            @click="removeRelation(r)"
          />
        </div>
      </div>
    </div>

    <!-- 追加フォーム -->
    <div v-if="adding" class="mt-2 space-y-2 rounded-md border border-default p-2">
      <div class="flex items-center gap-2">
        <SelectMenu
          :items="KIND_ITEMS"
          :current="newKind"
          @select="(v: string | null) => v && (newKind = v as RelationKind)"
        >
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            trailing-icon="i-lucide-chevron-down"
            :label="kindLabel"
          />
        </SelectMenu>
        <span class="text-xs text-muted">←</span>
        <USelectMenu
          v-model="newOtherId"
          :items="taskItems"
          value-key="value"
          placeholder="タスクを検索…（#番号・タイトル）"
          searchable
          search-placeholder="#番号・タイトルで検索…"
          class="min-w-0 flex-1"
        />
      </div>
      <div class="flex justify-end gap-1">
        <UButton color="neutral" variant="ghost" size="xs" label="キャンセル" @click="resetForm" />
        <UButton
          color="primary"
          size="xs"
          label="追加"
          :loading="saving"
          :disabled="!newOtherId"
          @click="addRelation"
        />
      </div>
    </div>
    <UButton
      v-else-if="!isReadonly"
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-plus"
      label="関連づけ"
      class="mt-1"
      @click="adding = true"
    />
  </CollapsibleSection>
</template>
