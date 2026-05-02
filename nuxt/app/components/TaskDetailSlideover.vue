<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DateValue } from '@internationalized/date'
import { createComment, updateComment } from '~/api/comments'
import { calendarDateToIso, isoToCalendarDate } from '~/utils/date'
import type { Member } from '~/types/member'
import type { Department, Tag, TaskPriority, TaskStatus } from '~/types/master'
import type { Task } from '~/types/task'

const props = defineProps<{
  task: Task | null
  open: boolean
  currentMemberId: string | null
  statusMap: Record<string, TaskStatus>
  priorityMap: Record<string, TaskPriority>
  memberMap: Record<string, Member>
  tagMap: Record<string, Tag>
  departmentMap: Record<string, Department>
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'change-field': [Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>]
}>()

const projectIdRef = computed(() => props.task?.projectId ?? '')
const taskIdRef = computed<number | null>(() => props.task?.id ?? null)

const { data: comments, refresh: refreshComments } = await useTaskComments(projectIdRef, taskIdRef)

const commentBody = ref('')
const posting = ref(false)

async function postComment() {
  const task = props.task
  const memberId = props.currentMemberId
  const body = commentBody.value.trim()
  if (!task || !memberId || !body) return
  posting.value = true
  try {
    await createComment(task.projectId, task.id, { authorMemberId: memberId, body })
    commentBody.value = ''
    await refreshComments()
  } finally {
    posting.value = false
  }
}

const editingCommentId = ref<number | null>(null)
const commentEditBuffer = ref('')
const savingEdit = ref(false)

function startEditComment(commentId: number, body: string) {
  editingCommentId.value = commentId
  commentEditBuffer.value = body
}

function cancelCommentEdit() {
  editingCommentId.value = null
  commentEditBuffer.value = ''
}

async function saveCommentEdit() {
  const task = props.task
  const id = editingCommentId.value
  const body = commentEditBuffer.value.trim()
  if (!task || id === null || !body) return
  savingEdit.value = true
  try {
    await updateComment(task.projectId, task.id, id, { body })
    editingCommentId.value = null
    commentEditBuffer.value = ''
    await refreshComments()
  } finally {
    savingEdit.value = false
  }
}

watch(() => props.task?.id, () => {
  cancelCommentEdit()
})

function fmtDate(d: string | null): string {
  return d ?? '—'
}

function fmtDateTime(d: string): string {
  return d.replace('T', ' ')
}

// ===== Text inline edit =====
type EditableField = 'content' | 'description' | 'trelloUrl'
const editingField = ref<EditableField | null>(null)
const editBuffer = ref('')
const cancelling = ref(false)

function startEdit(field: EditableField, current: string | null) {
  editingField.value = field
  editBuffer.value = current ?? ''
  cancelling.value = false
}

function commitEdit() {
  if (cancelling.value) {
    cancelling.value = false
    editingField.value = null
    return
  }
  if (!editingField.value || !props.task) {
    editingField.value = null
    return
  }
  const field = editingField.value
  const value = editBuffer.value
  if (field === 'content') {
    const trimmed = value.trim()
    if (trimmed && trimmed !== props.task.content) {
      emit('change-field', { content: trimmed })
    }
  } else if (field === 'description') {
    if (value !== props.task.description) {
      emit('change-field', { description: value })
    }
  } else if (field === 'trelloUrl') {
    const trimmed = value.trim() || null
    if (trimmed !== props.task.trelloUrl) {
      emit('change-field', { trelloUrl: trimmed })
    }
  }
  editingField.value = null
}

function cancelEdit() {
  cancelling.value = true
  editingField.value = null
}

watch(() => props.task?.id, () => {
  editingField.value = null
})

// ===== Status / Assignee / Priority / Requester / Department dropdowns =====
const statusItems = computed<DropdownMenuItem[][]>(() => {
  const list = Object.values(props.statusMap).sort((a, b) => a.order - b.order)
  const currentCode = props.task?.statusCode
  return [
    list.map((s) => {
      const isCurrent = s.code === currentCode
      return {
        label: s.label,
        icon: isCurrent ? 'i-lucide-check' : 'i-lucide-circle-dashed',
        class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
        onSelect: () => {
          if (isCurrent) return
          emit('change-field', { statusCode: s.code })
        }
      }
    })
  ]
})

function buildMemberItems(
  currentId: string | null | undefined,
  fieldName: 'assigneeMemberId' | 'requesterMemberId',
  allowNone: boolean
): DropdownMenuItem[][] {
  const list = Object.values(props.memberMap)
  const items: DropdownMenuItem[] = list.map((m) => {
    const isCurrent = m.id === currentId
    return {
      label: m.displayName,
      icon: isCurrent ? 'i-lucide-check' : 'i-lucide-user',
      class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
      onSelect: () => {
        if (isCurrent) return
        emit('change-field', { [fieldName]: m.id })
      }
    }
  })
  if (!allowNone) return [items]
  const noneItem: DropdownMenuItem = {
    label: 'なし',
    icon: !currentId ? 'i-lucide-check' : 'i-lucide-x',
    class: !currentId ? 'bg-elevated/80 font-semibold' : '',
    onSelect: () => {
      if (!currentId) return
      emit('change-field', { [fieldName]: null })
    }
  }
  return [items, [noneItem]]
}

const assigneeItems = computed(() => buildMemberItems(props.task?.assigneeMemberId, 'assigneeMemberId', false))
const requesterItems = computed(() => buildMemberItems(props.task?.requesterMemberId, 'requesterMemberId', true))

const priorityItems = computed<DropdownMenuItem[][]>(() => {
  const list = Object.values(props.priorityMap).sort((a, b) => a.order - b.order)
  const currentCode = props.task?.priorityCode ?? null
  const items: DropdownMenuItem[] = list.map((p) => {
    const isCurrent = p.code === currentCode
    return {
      label: p.label,
      icon: isCurrent ? 'i-lucide-check' : 'i-lucide-flag',
      class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
      onSelect: () => {
        if (isCurrent) return
        emit('change-field', { priorityCode: p.code })
      }
    }
  })
  const noneItem: DropdownMenuItem = {
    label: 'なし',
    icon: currentCode === null ? 'i-lucide-check' : 'i-lucide-x',
    class: currentCode === null ? 'bg-elevated/80 font-semibold' : '',
    onSelect: () => {
      if (currentCode === null) return
      emit('change-field', { priorityCode: null })
    }
  }
  return [items, [noneItem]]
})

const departmentItems = computed<DropdownMenuItem[][]>(() => {
  const list = Object.values(props.departmentMap)
  const currentCode = props.task?.requestingDeptCode ?? null
  const items: DropdownMenuItem[] = list.map((d) => {
    const isCurrent = d.code === currentCode
    return {
      label: d.name,
      icon: isCurrent ? 'i-lucide-check' : 'i-lucide-building-2',
      class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
      onSelect: () => {
        if (isCurrent) return
        emit('change-field', { requestingDeptCode: d.code })
      }
    }
  })
  const noneItem: DropdownMenuItem = {
    label: 'なし',
    icon: currentCode === null ? 'i-lucide-check' : 'i-lucide-x',
    class: currentCode === null ? 'bg-elevated/80 font-semibold' : '',
    onSelect: () => {
      if (currentCode === null) return
      emit('change-field', { requestingDeptCode: null })
    }
  }
  return [items, [noneItem]]
})

const tagsList = computed(() => Object.values(props.tagMap))

function toggleTag(tagCode: string, enabled: boolean) {
  if (!props.task) return
  const newTags = enabled
    ? [...props.task.tagCodes, tagCode]
    : props.task.tagCodes.filter(c => c !== tagCode)
  emit('change-field', { tagCodes: newTags })
}

function setDeadline(value: string | null) {
  emit('change-field', { deadline: value })
}

function setPlannedCompletionDate(value: string | null) {
  emit('change-field', { plannedCompletionDate: value })
}
</script>

<template>
  <USlideover
    :open="open"
    :title="task ? `#${task.id}` : ''"
    :description="task?.content ?? ''"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <template #body>
      <div v-if="task" class="space-y-4 p-1">
        <!-- 内容 (editable) -->
        <div>
          <p class="text-xs text-muted mb-1">
            内容
          </p>
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
          <p class="text-xs text-muted mb-1">
            説明
          </p>
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
            <p class="text-xs text-muted mb-1">
              ステータス
            </p>
            <UDropdownMenu
              v-if="statusMap[task.statusCode]"
              :items="statusItems"
            >
              <UBadge
                :color="statusMap[task.statusCode]!.color"
                variant="subtle"
                :label="statusMap[task.statusCode]!.label"
                class="cursor-pointer hover:opacity-80"
              />
            </UDropdownMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              優先度
            </p>
            <UDropdownMenu :items="priorityItems">
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
            </UDropdownMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              担当者
            </p>
            <UDropdownMenu :items="assigneeItems">
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{ memberMap[task.assigneeMemberId]?.displayName ?? '—' }}
                <UBadge
                  v-if="memberMap[task.assigneeMemberId]?.userId === null"
                  color="neutral"
                  size="sm"
                  variant="soft"
                  label="未紐付け"
                  class="ml-1"
                />
              </button>
            </UDropdownMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              期限
            </p>
            <UPopover>
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ fmtDate(task.deadline) }}
              </button>
              <template #content>
                <div class="p-2 space-y-2">
                  <UCalendar
                    :model-value="isoToCalendarDate(task.deadline)"
                    locale="ja"
                    @update:model-value="(d: DateValue | null) => setDeadline(calendarDateToIso(d))"
                  />
                  <UButton
                    v-if="task.deadline"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    block
                    label="クリア"
                    @click="setDeadline(null)"
                  />
                </div>
              </template>
            </UPopover>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              依頼部署
            </p>
            <UDropdownMenu :items="departmentItems">
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{ task.requestingDeptCode ? departmentMap[task.requestingDeptCode]?.name ?? '—' : '—' }}
              </button>
            </UDropdownMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              依頼者
            </p>
            <UDropdownMenu :items="requesterItems">
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{ task.requesterMemberId ? (memberMap[task.requesterMemberId]?.displayName ?? '—') : '—' }}
                <UBadge
                  v-if="task.requesterMemberId && memberMap[task.requesterMemberId]?.userId === null"
                  color="neutral"
                  size="sm"
                  variant="soft"
                  label="未紐付け"
                  class="ml-1"
                />
              </button>
            </UDropdownMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              完了予定日
            </p>
            <UPopover>
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ fmtDate(task.plannedCompletionDate) }}
              </button>
              <template #content>
                <div class="p-2 space-y-2">
                  <UCalendar
                    :model-value="isoToCalendarDate(task.plannedCompletionDate)"
                    locale="ja"
                    @update:model-value="(d: DateValue | null) => setPlannedCompletionDate(calendarDateToIso(d))"
                  />
                  <UButton
                    v-if="task.plannedCompletionDate"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    block
                    label="クリア"
                    @click="setPlannedCompletionDate(null)"
                  />
                </div>
              </template>
            </UPopover>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              作成日時
            </p>
            <p class="text-sm">
              {{ fmtDateTime(task.createdAt) }}
            </p>
          </div>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">
            タグ
          </p>
          <UPopover>
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
            <template #content>
              <div class="p-2 space-y-1 min-w-48">
                <label
                  v-for="t in tagsList"
                  :key="t.code"
                  class="flex items-center gap-2 px-2 py-1 hover:bg-elevated/40 rounded cursor-pointer"
                >
                  <UCheckbox
                    :model-value="task.tagCodes.includes(t.code)"
                    @update:model-value="(v: boolean) => toggleTag(t.code, v)"
                  />
                  <UBadge :color="t.color" variant="soft" size="sm" :label="t.name" />
                </label>
              </div>
            </template>
          </UPopover>
        </div>

        <!-- Trello (editable) -->
        <div>
          <p class="text-xs text-muted mb-1">
            Trello
          </p>
          <UInput
            v-if="editingField === 'trelloUrl'"
            v-model="editBuffer"
            autofocus
            type="url"
            placeholder="https://trello.com/c/..."
            class="w-full"
            @blur="commitEdit"
            @keydown.enter.prevent="commitEdit"
            @keydown.escape.prevent="cancelEdit"
          />
          <div v-else class="flex items-center gap-1">
            <ULink
              v-if="task.trelloUrl"
              :to="task.trelloUrl"
              target="_blank"
              class="text-sm flex-1 truncate"
            >
              {{ task.trelloUrl }}
            </ULink>
            <button
              v-else
              class="text-sm text-muted hover:text-default flex-1 text-left"
              @click="startEdit('trelloUrl', null)"
            >
              + URL を追加
            </button>
            <UButton
              v-if="task.trelloUrl"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              @click="startEdit('trelloUrl', task.trelloUrl)"
            />
          </div>
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
            <div
              v-for="c in comments"
              :key="c.id"
              class="flex gap-3 group"
            >
              <UAvatar
                :alt="memberMap[c.authorMemberId]?.displayName ?? '?'"
                size="sm"
              />
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
