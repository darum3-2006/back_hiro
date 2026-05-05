<script setup lang="ts">
import { createComment, updateComment } from '~/api/comments';
import type { Member } from '~/types/member';
import type { Department, Tag, TaskPriority, TaskStatus } from '~/types/master';
import type { Task, TaskLink } from '~/types/task';
import { fmtDate, fmtDateTime } from '~/utils/date';

const props = defineProps<{
  task: Task | null;
  open: boolean;
  currentMemberId: string | null;
  statusMap: Record<string, TaskStatus>;
  priorityMap: Record<string, TaskPriority>;
  memberMap: Record<string, Member>;
  tagMap: Record<string, Tag>;
  departmentMap: Record<string, Department>;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  'change-field': [Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>];
}>();

const projectIdRef = computed(() => props.task?.projectId ?? '');
const taskIdRef = computed<string | null>(() => props.task?.id ?? null);

const { data: comments, refresh: refreshComments } = await useTaskComments(projectIdRef, taskIdRef);

// ===== Comments =====
const commentBody = ref('');
const posting = ref(false);

const postComment = async () => {
  const task = props.task;
  const memberId = props.currentMemberId;
  const body = commentBody.value.trim();
  if (!task || !memberId || !body) return;
  posting.value = true;
  try {
    await createComment(task.projectId, task.id, { authorMemberId: memberId, body });
    commentBody.value = '';
    await refreshComments();
  } finally {
    posting.value = false;
  }
};

const editingCommentId = ref<string | null>(null);
const commentEditBuffer = ref('');
const savingEdit = ref(false);

const startEditComment = (commentId: string, body: string) => {
  editingCommentId.value = commentId;
  commentEditBuffer.value = body;
};

const cancelCommentEdit = () => {
  editingCommentId.value = null;
  commentEditBuffer.value = '';
};

const saveCommentEdit = async () => {
  const task = props.task;
  const id = editingCommentId.value;
  const body = commentEditBuffer.value.trim();
  if (!task || id === null || !body) return;
  savingEdit.value = true;
  try {
    await updateComment(task.projectId, task.id, id, { body });
    editingCommentId.value = null;
    commentEditBuffer.value = '';
    await refreshComments();
  } finally {
    savingEdit.value = false;
  }
};

// ===== Text inline edit =====
type EditableField = 'content' | 'description';
const editingField = ref<EditableField | null>(null);
const editBuffer = ref('');
const cancelling = ref(false);

const startEdit = (field: EditableField, current: string | null) => {
  editingField.value = field;
  editBuffer.value = current ?? '';
  cancelling.value = false;
};

const commitEdit = () => {
  if (cancelling.value) {
    cancelling.value = false;
    editingField.value = null;
    return;
  }
  if (!editingField.value || !props.task) {
    editingField.value = null;
    return;
  }
  const field = editingField.value;
  const value = editBuffer.value;
  if (field === 'content') {
    const trimmed = value.trim();
    if (trimmed && trimmed !== props.task.content) {
      emit('change-field', { content: trimmed });
    }
  } else if (field === 'description') {
    if (value !== props.task.description) {
      emit('change-field', { description: value });
    }
  }
  editingField.value = null;
};

const cancelEdit = () => {
  cancelling.value = true;
  editingField.value = null;
};

// ===== Links inline edit =====
const editingLinkIndex = ref<number | null>(null);
const linkEditBuffer = ref<TaskLink>({ label: '', url: '' });

const startAddLink = () => {
  editingLinkIndex.value = -1;
  linkEditBuffer.value = { label: '', url: '' };
};

const startEditLink = (index: number, link: TaskLink) => {
  editingLinkIndex.value = index;
  linkEditBuffer.value = { ...link };
};

const cancelLinkEdit = () => {
  editingLinkIndex.value = null;
};

const saveLink = () => {
  if (!props.task) return;
  const buffer = linkEditBuffer.value;
  const label = buffer.label.trim();
  const url = buffer.url.trim();
  if (!label || !url) return;
  const next = [...props.task.links];
  if (editingLinkIndex.value === -1) {
    next.push({ label, url });
  } else if (editingLinkIndex.value !== null) {
    next[editingLinkIndex.value] = { label, url };
  }
  emit('change-field', { links: next });
  editingLinkIndex.value = null;
};

const deleteLink = (index: number) => {
  if (!props.task) return;
  const next = props.task.links.filter((_, i) => i !== index);
  emit('change-field', { links: next });
};

watch(
  () => props.task?.id,
  () => {
    editingField.value = null;
    editingLinkIndex.value = null;
    cancelCommentEdit();
  },
);

// ===== Master select items =====
const statusSelectItems = computed(() =>
  Object.values(props.statusMap)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ value: s.code, label: s.label })),
);

const prioritySelectItems = computed(() =>
  Object.values(props.priorityMap)
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ value: p.code, label: p.label })),
);

const memberSelectItems = computed(() =>
  Object.values(props.memberMap).map((m) => ({ value: m.id, label: m.displayName })),
);

const departmentSelectItems = computed(() =>
  Object.values(props.departmentMap).map((d) => ({ value: d.code, label: d.name })),
);

const tagsList = computed(() => Object.values(props.tagMap));
</script>

<template>
  <USlideover
    :open="open"
    :title="task ? `#${task.seq}` : ''"
    :description="task?.content ?? ''"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <template #body>
      <div v-if="task" class="space-y-4 p-1">
        <!-- 内容 (editable) -->
        <div>
          <p class="text-xs text-muted mb-1">内容</p>
          <UInput
            v-if="editingField === 'content'"
            v-model="editBuffer"
            autofocus
            class="w-full"
            @blur="commitEdit"
            @keydown.enter.prevent="commitEdit"
            @keydown.escape.prevent="cancelEdit"
          />
          <button
            v-else
            class="text-sm whitespace-pre-wrap text-left w-full hover:bg-elevated/40 rounded px-1 -mx-1"
            @click="startEdit('content', task.content)"
          >
            {{ task.content }}
          </button>
        </div>

        <!-- 説明 (editable) -->
        <div>
          <p class="text-xs text-muted mb-1">説明</p>
          <UTextarea
            v-if="editingField === 'description'"
            v-model="editBuffer"
            autofocus
            :rows="4"
            autoresize
            class="w-full"
            @blur="commitEdit"
            @keydown.escape.prevent="cancelEdit"
          />
          <button
            v-else
            class="text-sm whitespace-pre-wrap text-left w-full hover:bg-elevated/40 rounded px-1 -mx-1 min-h-6"
            @click="startEdit('description', task.description)"
          >
            <span v-if="task.description">{{ task.description }}</span>
            <span v-else class="text-muted">クリックして説明を追加</span>
          </button>
        </div>

        <USeparator />

        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">ステータス</p>
            <SelectMenu
              v-if="statusMap[task.statusCode]"
              :items="statusSelectItems"
              :current="task.statusCode"
              default-icon="i-lucide-circle-dashed"
              @select="(c: string | null) => c && emit('change-field', { statusCode: c })"
            >
              <UBadge
                :color="statusMap[task.statusCode]!.color"
                variant="subtle"
                :label="statusMap[task.statusCode]!.label"
                class="cursor-pointer hover:opacity-80"
              />
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">優先度</p>
            <SelectMenu
              :items="prioritySelectItems"
              :current="task.priorityCode"
              allow-none
              default-icon="i-lucide-flag"
              @select="(c: string | null) => emit('change-field', { priorityCode: c })"
            >
              <UBadge
                v-if="task.priorityCode && priorityMap[task.priorityCode]"
                :color="priorityMap[task.priorityCode]!.color"
                variant="subtle"
                :label="priorityMap[task.priorityCode]!.label"
                class="cursor-pointer hover:opacity-80"
              />
              <UBadge
                v-else
                color="neutral"
                variant="outline"
                label="—"
                class="cursor-pointer hover:opacity-80"
              />
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">担当者</p>
            <SelectMenu
              :items="memberSelectItems"
              :current="task.assigneeMemberId"
              allow-none
              none-label="担当者なし"
              default-icon="i-lucide-user"
              @select="(c: string | null) => emit('change-field', { assigneeMemberId: c })"
            >
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{ memberMap[task.assigneeMemberId ?? '']?.displayName ?? '担当者なし' }}
                <UBadge
                  v-if="
                    task.assigneeMemberId &&
                    memberMap[task.assigneeMemberId]?.userId === null
                  "
                  color="neutral"
                  size="sm"
                  variant="soft"
                  label="未紐付け"
                  class="ml-1"
                />
              </button>
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">期限</p>
            <DatePopover
              :model-value="task.deadline"
              @update:model-value="(v: string | null) => emit('change-field', { deadline: v })"
            >
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ fmtDate(task.deadline) }}
              </button>
            </DatePopover>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">依頼部署</p>
            <SelectMenu
              :items="departmentSelectItems"
              :current="task.requestingDeptCode"
              allow-none
              default-icon="i-lucide-building-2"
              @select="(c: string | null) => emit('change-field', { requestingDeptCode: c })"
            >
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{
                  task.requestingDeptCode
                    ? (departmentMap[task.requestingDeptCode]?.name ?? '—')
                    : '—'
                }}
              </button>
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">依頼者</p>
            <SelectMenu
              :items="memberSelectItems"
              :current="task.requesterMemberId"
              allow-none
              default-icon="i-lucide-user"
              @select="(c: string | null) => emit('change-field', { requesterMemberId: c })"
            >
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{
                  task.requesterMemberId
                    ? (memberMap[task.requesterMemberId]?.displayName ?? '—')
                    : '—'
                }}
                <UBadge
                  v-if="
                    task.requesterMemberId && memberMap[task.requesterMemberId]?.userId === null
                  "
                  color="neutral"
                  size="sm"
                  variant="soft"
                  label="未紐付け"
                  class="ml-1"
                />
              </button>
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">完了予定日</p>
            <DatePopover
              :model-value="task.plannedCompletionDate"
              @update:model-value="
                (v: string | null) => emit('change-field', { plannedCompletionDate: v })
              "
            >
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ fmtDate(task.plannedCompletionDate) }}
              </button>
            </DatePopover>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">作成日時</p>
            <p class="text-sm">
              {{ fmtDateTime(task.createdAt) }}
            </p>
          </div>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">タグ</p>
          <TagPicker
            :tags="tagsList"
            :selected="task.tagCodes"
            @update:selected="(codes: string[]) => emit('change-field', { tagCodes: codes })"
          >
            <button class="flex flex-wrap gap-1 cursor-pointer">
              <UBadge
                v-for="code in task.tagCodes"
                :key="code"
                :color="tagMap[code]?.color ?? 'neutral'"
                variant="soft"
                :label="tagMap[code]?.name ?? code"
              />
              <UBadge
                v-if="task.tagCodes.length === 0"
                color="neutral"
                variant="outline"
                label="+ タグ"
              />
            </button>
          </TagPicker>
        </div>

        <!-- Links (editable list) -->
        <div>
          <p class="text-xs text-muted mb-1">リンク</p>
          <div class="space-y-1">
            <div v-for="(link, i) in task.links" :key="i" class="flex items-center gap-2 group">
              <template v-if="editingLinkIndex === i">
                <UInput
                  v-model="linkEditBuffer.label"
                  placeholder="ラベル"
                  class="w-32"
                  @keydown.enter.prevent="saveLink"
                  @keydown.escape.prevent="cancelLinkEdit"
                />
                <UInput
                  v-model="linkEditBuffer.url"
                  placeholder="https://..."
                  class="flex-1"
                  @keydown.enter.prevent="saveLink"
                  @keydown.escape.prevent="cancelLinkEdit"
                />
                <UButton
                  size="xs"
                  color="primary"
                  icon="i-lucide-check"
                  :disabled="!linkEditBuffer.label.trim() || !linkEditBuffer.url.trim()"
                  @click="saveLink"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  @click="cancelLinkEdit"
                />
              </template>
              <template v-else>
                <UBadge :label="link.label" color="neutral" variant="soft" size="sm" />
                <ULink :to="link.url" target="_blank" class="text-sm flex-1 truncate">
                  {{ link.url }}
                </ULink>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  class="opacity-0 group-hover:opacity-100 transition"
                  @click="startEditLink(i, link)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  class="opacity-0 group-hover:opacity-100 transition"
                  @click="deleteLink(i)"
                />
              </template>
            </div>

            <div v-if="editingLinkIndex === -1" class="flex items-center gap-2">
              <UInput
                v-model="linkEditBuffer.label"
                autofocus
                placeholder="ラベル"
                class="w-32"
                @keydown.enter.prevent="saveLink"
                @keydown.escape.prevent="cancelLinkEdit"
              />
              <UInput
                v-model="linkEditBuffer.url"
                placeholder="https://..."
                class="flex-1"
                @keydown.enter.prevent="saveLink"
                @keydown.escape.prevent="cancelLinkEdit"
              />
              <UButton
                size="xs"
                color="primary"
                icon="i-lucide-check"
                :disabled="!linkEditBuffer.label.trim() || !linkEditBuffer.url.trim()"
                @click="saveLink"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                @click="cancelLinkEdit"
              />
            </div>
          </div>

          <UButton
            v-if="editingLinkIndex !== -1"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-plus"
            label="リンクを追加"
            class="mt-1"
            @click="startAddLink"
          />
        </div>

        <USeparator />

        <div>
          <p class="text-sm font-medium mb-2">
            コメント <span class="text-muted">({{ comments.length }})</span>
          </p>

          <div v-if="comments.length === 0" class="text-sm text-muted py-2">
            まだコメントはありません。
          </div>

          <div v-else class="space-y-3">
            <div v-for="c in comments" :key="c.id" class="flex gap-3 group">
              <UAvatar :alt="memberMap[c.authorMemberId]?.displayName ?? '?'" size="sm" />
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2">
                  <span class="text-sm font-medium">
                    {{ memberMap[c.authorMemberId]?.displayName ?? '不明' }}
                  </span>
                  <span class="text-xs text-muted">{{ fmtDateTime(c.createdAt) }}</span>
                  <span v-if="c.updatedAt" class="text-xs text-muted">
                    (編集済み {{ fmtDateTime(c.updatedAt) }})
                  </span>
                  <UButton
                    v-if="c.authorMemberId === currentMemberId && editingCommentId !== c.id"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    class="ml-auto opacity-0 group-hover:opacity-100 transition"
                    @click="startEditComment(c.id, c.body)"
                  />
                </div>

                <div v-if="editingCommentId === c.id" class="mt-1 space-y-2">
                  <UTextarea
                    v-model="commentEditBuffer"
                    autofocus
                    :rows="3"
                    autoresize
                    class="w-full"
                  />
                  <div class="flex gap-2">
                    <UButton
                      size="sm"
                      color="primary"
                      :loading="savingEdit"
                      :disabled="!commentEditBuffer.trim()"
                      label="保存"
                      @click="saveCommentEdit"
                    />
                    <UButton
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      label="キャンセル"
                      @click="cancelCommentEdit"
                    />
                  </div>
                </div>

                <p v-else class="text-sm whitespace-pre-wrap mt-0.5">
                  {{ c.body }}
                </p>
              </div>
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <UTextarea
              v-model="commentBody"
              :rows="3"
              :disabled="!currentMemberId"
              placeholder="コメントを入力…"
              class="w-full"
            />
            <div class="flex items-center justify-between">
              <span v-if="!currentMemberId" class="text-xs text-warning">
                このプロジェクトのメンバーではないためコメントできません
              </span>
              <span v-else class="text-xs text-muted">
                投稿者: {{ memberMap[currentMemberId!]?.displayName ?? '?' }}
              </span>
              <UButton
                color="primary"
                :loading="posting"
                :disabled="!commentBody.trim() || !currentMemberId"
                label="コメントする"
                @click="postComment"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
