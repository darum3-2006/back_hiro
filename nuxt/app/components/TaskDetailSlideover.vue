<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DateValue } from '@internationalized/date'
import { createComment } from '~/api/comments'
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

function fmtDate(d: string | null): string {
  return d ?? '—'
}

function fmtDateTime(d: string): string {
  return d.replace('T', ' ')
}

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

const assigneeItems = computed<DropdownMenuItem[][]>(() => {
  const list = Object.values(props.memberMap)
  const currentId = props.task?.assigneeMemberId
  return [
    list.map((m) => {
      const isCurrent = m.id === currentId
      return {
        label: m.displayName,
        icon: isCurrent ? 'i-lucide-check' : 'i-lucide-user',
        class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
        onSelect: () => {
          if (isCurrent) return
          emit('change-field', { assigneeMemberId: m.id })
        }
      }
    })
  ]
})

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
        <div>
          <p class="text-xs text-muted mb-1">
            内容
          </p>
          <p class="text-sm whitespace-pre-wrap">
            {{ task.content }}
          </p>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">
            説明
          </p>
          <p class="text-sm whitespace-pre-wrap">
            {{ task.description || '—' }}
          </p>
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
            <p class="text-sm">
              {{ task.requestingDeptCode ? departmentMap[task.requestingDeptCode]?.name ?? '—' : '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              依頼者
            </p>
            <p class="text-sm">
              {{ memberMap[task.requesterMemberId]?.displayName ?? '—' }}
              <UBadge
                v-if="memberMap[task.requesterMemberId]?.userId === null"
                color="neutral"
                size="sm"
                variant="soft"
                label="未紐付け"
                class="ml-1"
              />
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              完了予定日
            </p>
            <p class="text-sm">
              {{ fmtDate(task.plannedCompletionDate) }}
            </p>
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

        <div>
          <p class="text-xs text-muted mb-1">
            Trello
          </p>
          <ULink
            v-if="task.trelloUrl"
            :to="task.trelloUrl"
            target="_blank"
            class="text-sm"
          >
            {{ task.trelloUrl }}
          </ULink>
          <span v-else class="text-sm text-muted">—</span>
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
              class="flex gap-3"
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
                </div>
                <p class="text-sm whitespace-pre-wrap mt-0.5">
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
