<script setup lang="ts">
import dayjs from 'dayjs';
import { apiCreateComment, apiUpdateComment } from '~/api/comments';
import type { TaskActivity } from '~/types/activity';
import type { Comment } from '~/types/comment';
import type { Member } from '~/types/member';
import type { Department, Tag, TaskPriority, TaskStatus } from '~/types/master';
import type { Task, TaskLink } from '~/types/task';
import { fmtDate, fmtDateTime } from '~/utils/date';
import { hasImageUrl } from '~/utils/image-url';
import { resolveLinkLabelFromUrl } from '~/utils/link-label';
import { isTaskDatePast } from '~/utils/task-overdue';

/** 作成と更新の差が 1 秒以上なら「編集済み」とみなす（DB の updated_at は作成時にも入るため） */
const isCommentEdited = (c: { createdAt: string; updatedAt: string | null }): boolean => {
  if (!c.updatedAt) return false;
  return dayjs(c.updatedAt).diff(c.createdAt, 'second') >= 1;
};

const isOverdue = computed(() =>
  props.task ? isTaskDatePast(props.task.deadline, props.task.statusCode, props.statusMap) : false,
);

const isPlannedCompletionOverdue = computed(() =>
  props.task
    ? isTaskDatePast(props.task.plannedCompletionDate, props.task.statusCode, props.statusMap)
    : false,
);

const api = useApi();

const props = defineProps<{
  task: Task | null;
  /** 同プロジェクトの全タスク（#番号 リンク解決用） */
  tasks: Task[];
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
const { data: activities, refresh: refreshActivities } = await useTaskActivities(
  projectIdRef,
  taskIdRef,
);

// ===== Activity timeline（コメント＋変更履歴の統合） =====
// 変更履歴の表示トグル（既定 OFF）。普段はコメント中心、ON で変更履歴も差し込む。
// ユーザーの選択は localStorage に永続化する（KEEP_OPEN と同じ流儀）。
const SHOW_ACTIVITY_KEY = 'task-detail:show-activity';
const showActivity = ref(false);
onMounted(() => {
  showActivity.value = localStorage.getItem(SHOW_ACTIVITY_KEY) === '1';
});
watch(showActivity, (v) => {
  localStorage.setItem(SHOW_ACTIVITY_KEY, v ? '1' : '0');
});

// 説明内の画像 URL を縮小画像で表示するか（既定 ON）。選択は localStorage に永続化。
const SHOW_IMAGES_KEY = 'task-detail:show-images';
const showImages = ref(true);
onMounted(() => {
  const v = localStorage.getItem(SHOW_IMAGES_KEY);
  if (v !== null) showImages.value = v === '1';
});
watch(showImages, (v) => {
  localStorage.setItem(SHOW_IMAGES_KEY, v ? '1' : '0');
});

// 説明に画像 URL があるときだけ「画像を表示する」スイッチを出す
const descriptionHasImage = computed(() => hasImageUrl(props.task?.description ?? ''));

type TimelineItem =
  | { kind: 'comment'; id: string; at: string; comment: Comment }
  | { kind: 'activity'; id: string; at: string; activity: TaskActivity };

const timeline = computed<TimelineItem[]>(() => {
  const items: TimelineItem[] = comments.value.map((c) => ({
    kind: 'comment',
    id: `c:${c.id}`,
    at: c.createdAt,
    comment: c,
  }));
  if (showActivity.value) {
    for (const a of activities.value) {
      items.push({ kind: 'activity', id: `a:${a.id}`, at: a.createdAt, activity: a });
    }
  }
  return items.sort((x, y) => dayjs(x.at).valueOf() - dayjs(y.at).valueOf());
});

// このパネル内でフィールドを編集すると親が PATCH → task.updatedAt が変わるので、
// それを検知して履歴を取り直す。
watch(
  () => props.task?.updatedAt,
  (next, prev) => {
    if (next && next !== prev) refreshActivities();
  },
);

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
    await apiCreateComment(api, task.projectId, task.id, { authorMemberId: memberId, body });
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
    await apiUpdateComment(api, task.projectId, task.id, id, { body });
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

// コピー目的でテキストをドラッグ選択しただけでは編集に入らないようにする
const hasTextSelection = () => {
  const sel = window.getSelection();
  return !!sel && sel.type === 'Range' && sel.toString().trim().length > 0;
};

const startEdit = (field: EditableField, current: string | null) => {
  if (hasTextSelection()) return;
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

// URL 貼り付け時、ラベルが空かつ既知ドメインなら自動でラベルをセットする
const onLinkUrlPaste = (e: ClipboardEvent) => {
  if (linkEditBuffer.value.label.trim()) return;
  const text = e.clipboardData?.getData('text') ?? '';
  const label = resolveLinkLabelFromUrl(text);
  if (label) linkEditBuffer.value.label = label;
};

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

const toast = useToast();

const copyToClipboard = async (text: string, successTitle: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ title: successTitle, color: 'success', icon: 'i-lucide-check' });
  } catch {
    toast.add({ title: 'コピーに失敗しました', color: 'error' });
  }
};

const copyLink = (url: string) => copyToClipboard(url, 'リンクをコピーしました');
const copyContent = (content: string) => copyToClipboard(content, '内容をコピーしました');

const currentTenantKey = useCurrentTenantKey();

/** /:tenantKey/:shortCode 形式の共有リンクをコピーする */
const copyShareLink = () => {
  const task = props.task;
  if (!task) return;
  const url = `${window.location.origin}/${currentTenantKey.value}/${task.shortCode}`;
  copyToClipboard(url, 'タスクのリンクをコピーしました');
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
    <template #description>
      <div class="flex items-start gap-2">
        <span class="flex-1">{{ task?.content }}</span>
        <UButton
          v-if="task"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-link"
          aria-label="タスクのリンクをコピー"
          @click="copyShareLink"
        />
        <UButton
          v-if="task"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-copy"
          aria-label="内容をコピー"
          @click="copyContent(task.content)"
        />
      </div>
    </template>

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
          <div
            v-else
            class="text-sm whitespace-pre-wrap text-left w-full hover:bg-elevated/40 rounded px-1 -mx-1 cursor-text"
            @click="startEdit('content', task.content)"
          >
            {{ task.content }}
          </div>
        </div>

        <!-- 説明 (editable) -->
        <div>
          <div class="mb-1 flex items-center justify-between gap-2">
            <p class="text-xs text-muted">説明</p>
            <USwitch
              v-if="descriptionHasImage"
              v-model="showImages"
              size="sm"
              label="画像を表示する"
            />
          </div>
          <UTextarea
            v-if="editingField === 'description'"
            v-model="editBuffer"
            autofocus
            :rows="4"
            autoresize
            class="w-full"
            @blur="commitEdit"
            @keydown.ctrl.enter.exact.prevent="commitEdit"
            @keydown.meta.enter.exact.prevent="commitEdit"
            @keydown.escape.prevent="cancelEdit"
          />
          <div
            v-else
            class="text-sm text-left w-full hover:bg-elevated/40 rounded px-1 -mx-1 min-h-6 cursor-text"
            @click="startEdit('description', task.description)"
          >
            <LinkedText
              v-if="task.description"
              :text="task.description"
              :tasks="tasks"
              :show-images="showImages"
            />
            <span v-else class="text-muted">クリックして説明を追加</span>
          </div>
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
              searchable
              search-placeholder="名前で検索…"
              @select="(c: string | null) => emit('change-field', { assigneeMemberId: c })"
            >
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{ memberMap[task.assigneeMemberId ?? '']?.displayName ?? '担当者なし' }}
                <UBadge
                  v-if="task.assigneeMemberId && memberMap[task.assigneeMemberId]?.userId === null"
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
              <button
                class="text-sm tabular-nums hover:underline cursor-pointer text-left"
                :class="isOverdue ? 'text-error font-medium' : ''"
              >
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
              searchable
              search-placeholder="名前で検索…"
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
              <button
                class="text-sm tabular-nums hover:underline cursor-pointer text-left"
                :class="isPlannedCompletionOverdue ? 'text-error font-medium' : ''"
              >
                {{ fmtDate(task.plannedCompletionDate) }}
              </button>
            </DatePopover>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">リリース予定日</p>
            <DatePopover
              :model-value="task.plannedReleaseDate"
              @update:model-value="
                (v: string | null) => emit('change-field', { plannedReleaseDate: v })
              "
            >
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ fmtDate(task.plannedReleaseDate) }}
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
                  @paste="onLinkUrlPaste"
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
                  icon="i-lucide-copy"
                  aria-label="URL をコピー"
                  class="opacity-0 group-hover:opacity-100 transition"
                  @click="copyLink(link.url)"
                />
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
              <!-- Tab 順を URL → ラベル → ボタン にするため、DOM 上は URL を先に置き、
                   ラベルは order-first で視覚的に先頭へ戻している。 -->
              <UInput
                v-model="linkEditBuffer.url"
                autofocus
                placeholder="https://..."
                class="flex-1"
                @paste="onLinkUrlPaste"
                @keydown.enter.prevent="saveLink"
                @keydown.escape.prevent="cancelLinkEdit"
              />
              <UInput
                v-model="linkEditBuffer.label"
                placeholder="ラベル"
                class="w-32 order-first"
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
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-medium">コメント・履歴</p>
            <USwitch v-model="showActivity" size="sm" label="変更履歴" />
          </div>

          <div v-if="timeline.length === 0" class="text-sm text-muted py-2">
            まだコメントや履歴はありません。
          </div>

          <div v-else class="space-y-3">
            <template v-for="item in timeline" :key="item.id">
              <!-- コメント -->
              <div v-if="item.kind === 'comment'" class="flex gap-3 group">
                <UAvatar
                  :alt="memberMap[item.comment.authorMemberId]?.displayName ?? '?'"
                  size="sm"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-2">
                    <span class="text-sm font-medium">
                      {{ memberMap[item.comment.authorMemberId]?.displayName ?? '不明' }}
                    </span>
                    <span class="text-xs text-muted">{{
                      fmtDateTime(item.comment.createdAt)
                    }}</span>
                    <span v-if="isCommentEdited(item.comment)" class="text-xs text-muted">
                      (編集済み {{ fmtDateTime(item.comment.updatedAt) }})
                    </span>
                    <UButton
                      v-if="
                        item.comment.authorMemberId === currentMemberId &&
                        editingCommentId !== item.comment.id
                      "
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      class="ml-auto opacity-0 group-hover:opacity-100 transition"
                      @click="startEditComment(item.comment.id, item.comment.body)"
                    />
                  </div>

                  <div v-if="editingCommentId === item.comment.id" class="mt-1 space-y-2">
                    <UTextarea
                      v-model="commentEditBuffer"
                      autofocus
                      :rows="3"
                      autoresize
                      class="w-full"
                      @keydown.ctrl.enter.exact.prevent="saveCommentEdit"
                      @keydown.meta.enter.exact.prevent="saveCommentEdit"
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

                  <p v-else class="text-sm mt-0.5">
                    <LinkedText :text="item.comment.body" :tasks="tasks" />
                  </p>
                </div>
              </div>

              <!-- 変更履歴 -->
              <div v-else class="flex gap-3">
                <div class="flex size-8 shrink-0 items-center justify-center">
                  <UIcon name="i-lucide-history" class="size-4 text-muted" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-2">
                    <span class="text-sm font-medium">
                      {{ item.activity.actor.name ?? '（削除済みユーザー）' }}
                    </span>
                    <span class="text-xs text-muted">{{
                      fmtDateTime(item.activity.createdAt)
                    }}</span>
                  </div>
                  <p v-if="item.activity.action === 'create'" class="mt-0.5 text-sm text-muted">
                    タスクを作成
                  </p>
                  <p
                    v-else-if="item.activity.action === 'delete'"
                    class="mt-0.5 text-sm text-muted"
                  >
                    タスクを削除
                  </p>
                  <ul v-else class="mt-0.5 space-y-0.5 text-sm text-muted">
                    <li v-for="(ch, idx) in item.activity.changes ?? []" :key="idx">
                      {{ describeAuditChange(ch) }}
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </div>

          <div class="mt-4 space-y-2">
            <UTextarea
              v-model="commentBody"
              :rows="3"
              :disabled="!currentMemberId"
              placeholder="コメントを入力（Cmd/Ctrl+Enter で投稿）…"
              class="w-full"
              @keydown.ctrl.enter.exact.prevent="postComment"
              @keydown.meta.enter.exact.prevent="postComment"
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
