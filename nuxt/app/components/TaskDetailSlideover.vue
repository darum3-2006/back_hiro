<script setup lang="ts">
import { createComment } from '~/api/comments'
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

defineEmits<{ 'update:open': [boolean] }>()

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
            <UBadge
              v-if="statusMap[task.statusCode]"
              :color="statusMap[task.statusCode]!.color"
              variant="subtle"
              :label="statusMap[task.statusCode]!.label"
            />
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              優先度
            </p>
            <UBadge
              v-if="task.priorityCode && priorityMap[task.priorityCode]"
              :color="priorityMap[task.priorityCode]!.color"
              variant="subtle"
              :label="priorityMap[task.priorityCode]!.label"
            />
            <span v-else class="text-sm text-muted">—</span>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              担当者
            </p>
            <p class="text-sm">
              {{ memberMap[task.assigneeMemberId]?.displayName ?? '—' }}
              <UBadge
                v-if="memberMap[task.assigneeMemberId]?.userId === null"
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
              期限
            </p>
            <p class="text-sm">
              {{ fmtDate(task.deadline) }}
            </p>
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
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="code in task.tagCodes"
              :key="code"
              :color="tagMap[code]?.color ?? 'neutral'"
              variant="soft"
              :label="tagMap[code]?.name ?? code"
            />
            <span v-if="task.tagCodes.length === 0" class="text-sm text-muted">—</span>
          </div>
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
