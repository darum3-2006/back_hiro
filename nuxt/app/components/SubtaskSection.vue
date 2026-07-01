<script setup lang="ts">
import dayjs from 'dayjs';
import { VueDraggable } from 'vue-draggable-plus';
import {
  apiCreateSubtask,
  apiDeleteSubtask,
  apiReorderSubtasks,
  apiUpdateSubtask,
} from '~/api/subtasks';
import type { Member } from '~/types/member';
import type { Subtask } from '~/types/subtask';
import type { Task } from '~/types/task';
import { fmtDate } from '~/utils/date';

const props = defineProps<{
  projectId: string;
  taskId: string;
  members: Member[];
  /** 親の期限（子が超過していたら警告） */
  parentDeadline: string | null;
  /** 親が終端（完了扱い）か。true の間は追加・完了解除を抑止 */
  parentTerminal: boolean;
  /** #seq リンク解決用（メモの Markdown プレビュー） */
  tasks?: Task[];
}>();

const emit = defineEmits<{
  /** サブタスクに変更があった（親側で一覧の進捗を再取得する用） */
  changed: [];
}>();

const api = useApi();
const toast = useToast();

// IME 変換中フラグ。変換確定/キャンセルの Enter・ESC を本来の操作と区別する
// （keydown 時点では compositionend より前なので true のまま）。
const composing = ref(false);
const onCompositionStart = () => {
  composing.value = true;
};
const onCompositionEnd = () => {
  composing.value = false;
};
const isImeKey = (e: KeyboardEvent): boolean => composing.value || e.isComposing;

const projectIdRef = computed(() => props.projectId);
const taskIdRef = computed<string | null>(() => props.taskId || null);
// await しない（動的にマウントされる子で Suspense 境界を要求しないため）
const { data: subtasks, refresh } = useSubtasks(projectIdRef, taskIdRef);

// ドラッグ並び替え用のローカル配列（取得データに追従）
const rows = ref<Subtask[]>([]);
watch(subtasks, (v) => (rows.value = [...v]), { immediate: true });

const doneCount = computed(() => rows.value.filter((s) => s.done).length);

const memberItems = computed(() =>
  props.members.map((m) => ({ value: m.id, label: m.displayName })),
);
const memberName = (id: string | null): string =>
  id ? (props.members.find((m) => m.id === id)?.displayName ?? '不明') : '担当者なし';

const isOverParent = (deadline: string | null): boolean =>
  Boolean(deadline && props.parentDeadline && deadline > props.parentDeadline);

// 期限切れ = 期限が今日より前 かつ 未完了
const isOverdue = (s: Subtask): boolean =>
  Boolean(s.deadline) && !s.done && dayjs(s.deadline).isBefore(dayjs(), 'day');

const notify = () => {
  emit('changed');
};

// ===== 追加 =====
const newTitle = ref('');
const adding = ref(false);
const addSubtask = async () => {
  const title = newTitle.value.trim();
  if (!title || adding.value) return;
  adding.value = true;
  try {
    await apiCreateSubtask(api, props.projectId, props.taskId, { title });
    newTitle.value = '';
    await refresh();
    notify();
  } catch {
    toast.add({ title: 'サブタスクの追加に失敗しました', color: 'error' });
  } finally {
    adding.value = false;
  }
};

// ===== 更新（汎用） =====
const patch = async (id: string, body: Parameters<typeof apiUpdateSubtask>[4]) => {
  try {
    await apiUpdateSubtask(api, props.projectId, props.taskId, id, body);
    await refresh();
    notify();
  } catch (e) {
    const msg = (e as { data?: { message?: string } })?.data?.message;
    toast.add({ title: msg ?? '更新に失敗しました', color: 'error' });
    await refresh(); // 楽観的変更のロールバック
  }
};

const toggleDone = (s: Subtask, done: boolean) => patch(s.id, { done });

// タイトルのインライン編集
const editingTitleId = ref<string | null>(null);
const titleBuffer = ref('');
const startEditTitle = (s: Subtask) => {
  editingTitleId.value = s.id;
  titleBuffer.value = s.title;
};
const commitTitle = async (s: Subtask) => {
  const id = editingTitleId.value;
  editingTitleId.value = null;
  const next = titleBuffer.value.trim();
  if (!id || !next || next === s.title) return;
  await patch(id, { title: next });
};

// メモ（Markdown）
const expandedMemoId = ref<string | null>(null);
const editingMemoId = ref<string | null>(null);
const memoBuffer = ref('');
const toggleMemo = (s: Subtask) => {
  expandedMemoId.value = expandedMemoId.value === s.id ? null : s.id;
  editingMemoId.value = null;
};
const startEditMemo = (s: Subtask) => {
  editingMemoId.value = s.id;
  memoBuffer.value = s.memo ?? '';
};
const commitMemo = async (s: Subtask) => {
  const id = editingMemoId.value;
  editingMemoId.value = null;
  if (!id) return;
  const next = memoBuffer.value;
  if ((s.memo ?? '') === next) return;
  await patch(id, { memo: next });
};

// メモ編集中の Esc はスライドオーバーへ伝播させない（親のスライドオーバーが閉じるのを防ぐ）。
// - メンション候補を閉じただけ（MentionTextarea が preventDefault 済み）や IME 変換キャンセルは、編集を続行
// - それ以外はメモ編集をキャンセル
const onMemoEscape = (e: KeyboardEvent) => {
  e.stopPropagation();
  if (e.defaultPrevented || isImeKey(e)) return;
  editingMemoId.value = null;
};

const removeSubtask = async (s: Subtask) => {
  try {
    await apiDeleteSubtask(api, props.projectId, props.taskId, s.id);
    await refresh();
    notify();
  } catch {
    toast.add({ title: '削除に失敗しました', color: 'error' });
  }
};

const onReorder = async () => {
  const ids = rows.value.map((s) => s.id);
  try {
    await apiReorderSubtasks(api, props.projectId, props.taskId, ids);
    await refresh();
    notify();
  } catch {
    toast.add({ title: '並び替えに失敗しました', color: 'error' });
    await refresh();
  }
};
</script>

<template>
  <CollapsibleSection title="サブタスク" icon="i-lucide-list-todo">
    <template #trailing>
      <span v-if="rows.length > 0" class="text-xs text-muted">
        {{ doneCount }}/{{ rows.length }}
      </span>
    </template>

    <p v-if="parentTerminal" class="text-xs text-muted mb-2">
      このタスクは完了しています。サブタスクの追加・完了解除はできません（先に親のステータスを戻してください）。
    </p>

    <VueDraggable v-model="rows" :animation="150" handle=".subtask-drag" @end="onReorder">
      <div
        v-for="s in rows"
        :key="s.id"
        class="group flex items-start gap-2 rounded px-1 py-1 hover:bg-elevated/40"
      >
        <UIcon
          name="i-lucide-grip-vertical"
          class="subtask-drag mt-1 size-4 shrink-0 cursor-move text-muted opacity-0 group-hover:opacity-100"
        />
        <USwitch
          :model-value="s.done"
          :disabled="s.done && parentTerminal"
          size="sm"
          class="mt-0.5"
          :aria-label="`${s.title} を完了`"
          @update:model-value="(v: boolean) => toggleDone(s, v)"
        />

        <div class="min-w-0 flex-1">
          <!-- タイトル -->
          <div class="flex items-center gap-1.5">
            <UInput
              v-if="editingTitleId === s.id"
              v-model="titleBuffer"
              autofocus
              size="xs"
              class="flex-1"
              @blur="commitTitle(s)"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd"
              @keydown.enter="
                (e: KeyboardEvent) => {
                  if (isImeKey(e)) return;
                  e.preventDefault();
                  commitTitle(s);
                }
              "
              @keydown.escape="
                (e: KeyboardEvent) => {
                  if (isImeKey(e)) return;
                  e.preventDefault();
                  editingTitleId = null;
                }
              "
            />
            <button
              v-else
              class="truncate text-left text-sm hover:underline"
              :class="s.done ? 'text-muted line-through' : ''"
              @click="startEditTitle(s)"
            >
              {{ s.title }}
            </button>
          </div>

          <!-- メタ行: 担当 / 期限 / メモトグル -->
          <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <SelectMenu
              :items="memberItems"
              :current="s.assigneeMemberId"
              allow-none
              none-label="担当者なし"
              default-icon="i-lucide-user"
              searchable
              search-placeholder="名前で検索…"
              @select="(c: string | null) => patch(s.id, { assigneeMemberId: c })"
            >
              <button class="inline-flex items-center gap-1 hover:text-default">
                <UIcon name="i-lucide-user" class="size-3.5" />
                {{ memberName(s.assigneeMemberId) }}
              </button>
            </SelectMenu>

            <DatePopover
              :model-value="s.deadline"
              @update:model-value="(v: string | null) => patch(s.id, { deadline: v })"
            >
              <button
                class="inline-flex items-center gap-1 hover:text-default"
                :class="
                  isOverdue(s) ? 'text-error' : isOverParent(s.deadline) ? 'text-warning' : ''
                "
              >
                <UIcon name="i-lucide-calendar" class="size-3.5" />
                {{ s.deadline ? fmtDate(s.deadline) : '期限なし' }}
                <UIcon
                  v-if="isOverParent(s.deadline)"
                  name="i-lucide-triangle-alert"
                  class="size-3.5"
                  title="親タスクの期限を超えています"
                />
              </button>
            </DatePopover>

            <button
              class="inline-flex items-center gap-1 hover:text-default"
              :class="s.memo ? 'text-primary' : ''"
              @click="toggleMemo(s)"
            >
              <UIcon name="i-lucide-notebook-pen" class="size-3.5" />
              メモ{{ s.memo ? '' : 'なし' }}
            </button>
          </div>

          <!-- メモ展開エリア -->
          <div v-if="expandedMemoId === s.id" class="mt-1.5" @keydown.esc="onMemoEscape">
            <MarkdownEditor
              v-if="editingMemoId === s.id"
              :model-value="memoBuffer"
              :tasks="tasks ?? []"
              :rows="4"
              placeholder="メモ（Markdown 可・Cmd/Ctrl+Enter で保存）"
              @update:model-value="(v: string) => (memoBuffer = v)"
              @submit="commitMemo(s)"
            />
            <div v-else>
              <MarkdownContent v-if="s.memo" :text="s.memo" :tasks="tasks ?? []" />
              <p v-else class="text-xs text-muted">メモはありません</p>
            </div>
            <div class="mt-1 flex justify-end gap-1">
              <template v-if="editingMemoId === s.id">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  label="キャンセル"
                  @click="editingMemoId = null"
                />
                <UButton size="xs" color="primary" label="保存" @click="commitMemo(s)" />
              </template>
              <UButton
                v-else
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                label="メモを編集"
                @click="startEditMemo(s)"
              />
            </div>
          </div>
        </div>

        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-trash-2"
          class="opacity-0 group-hover:opacity-100"
          :aria-label="`${s.title} を削除`"
          @click="removeSubtask(s)"
        />
      </div>
    </VueDraggable>

    <!-- 追加 -->
    <div v-if="!parentTerminal" class="mt-2 flex items-center gap-2">
      <UInput
        v-model="newTitle"
        size="sm"
        class="flex-1"
        placeholder="サブタスクを追加…"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
        @keydown.enter="
          (e: KeyboardEvent) => {
            if (isImeKey(e)) return;
            e.preventDefault();
            addSubtask();
          }
        "
      />
      <UButton
        color="neutral"
        size="sm"
        icon="i-lucide-plus"
        label="追加"
        :loading="adding"
        :disabled="!newTitle.trim()"
        @click="addSubtask"
      />
    </div>
  </CollapsibleSection>
</template>
