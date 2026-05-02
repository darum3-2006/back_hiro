<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DateValue } from '@internationalized/date'
import { createTask } from '~/api/tasks'
import { calendarDateToIso, isoToCalendarDate } from '~/utils/date'
import type { Member } from '~/types/member'
import type { Department, Tag, TaskPriority, TaskStatus } from '~/types/master'
import type { Task } from '~/types/task'

const props = defineProps<{
  open: boolean
  projectId: string
  currentMemberId: string | null
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  tags: Tag[]
  members: Member[]
  departments: Department[]
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'created': [Task]
}>()

type Draft = Omit<Task, 'id' | 'projectId' | 'createdAt'>

function makeInitialDraft(): Draft {
  return {
    content: '',
    description: '',
    trelloUrl: null,
    requesterMemberId: props.currentMemberId,
    requestingDeptCode: null,
    assigneeMemberId: props.currentMemberId ?? '',
    priorityCode: null,
    statusCode: props.statuses[0]?.code ?? '',
    deadline: null,
    plannedCompletionDate: null,
    tagCodes: []
  }
}


const draft = ref<Draft>(makeInitialDraft())
const submitting = ref(false)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    draft.value = makeInitialDraft()
  }
})

const canSubmit = computed(() => Boolean(
  draft.value.content.trim()
  && draft.value.assigneeMemberId
  && draft.value.statusCode
))

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const task = await createTask(props.projectId, {
      ...draft.value,
      content: draft.value.content.trim(),
      description: draft.value.description.trim()
    })
    emit('created', task)
    emit('update:open', false)
  } finally {
    submitting.value = false
  }
}

const statusMap = computed(() => Object.fromEntries(props.statuses.map(s => [s.code, s])))
const priorityMap = computed(() => Object.fromEntries(props.priorities.map(p => [p.code, p])))
const memberMap = computed(() => Object.fromEntries(props.members.map(m => [m.id, m])))
const departmentMap = computed(() => Object.fromEntries(props.departments.map(d => [d.code, d])))

const statusItems = computed<DropdownMenuItem[][]>(() => {
  const sorted = [...props.statuses].sort((a, b) => a.order - b.order)
  return [
    sorted.map((s) => {
      const isCurrent = s.code === draft.value.statusCode
      return {
        label: s.label,
        icon: isCurrent ? 'i-lucide-check' : 'i-lucide-circle-dashed',
        class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
        onSelect: () => { draft.value.statusCode = s.code }
      }
    })
  ]
})

const priorityItems = computed<DropdownMenuItem[][]>(() => {
  const sorted = [...props.priorities].sort((a, b) => a.order - b.order)
  const items: DropdownMenuItem[] = sorted.map((p) => {
    const isCurrent = p.code === draft.value.priorityCode
    return {
      label: p.label,
      icon: isCurrent ? 'i-lucide-check' : 'i-lucide-flag',
      class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
      onSelect: () => { draft.value.priorityCode = p.code }
    }
  })
  const noneItem: DropdownMenuItem = {
    label: 'なし',
    icon: draft.value.priorityCode === null ? 'i-lucide-check' : 'i-lucide-x',
    class: draft.value.priorityCode === null ? 'bg-elevated/80 font-semibold' : '',
    onSelect: () => { draft.value.priorityCode = null }
  }
  return [items, [noneItem]]
})

function buildMemberItems(currentId: string | null, fieldName: 'assigneeMemberId' | 'requesterMemberId', allowNone: boolean): DropdownMenuItem[][] {
  const items: DropdownMenuItem[] = props.members.map((m) => {
    const isCurrent = m.id === currentId
    return {
      label: m.displayName,
      icon: isCurrent ? 'i-lucide-check' : 'i-lucide-user',
      class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
      onSelect: () => {
        draft.value[fieldName] = m.id
      }
    }
  })
  if (!allowNone) return [items]
  const noneItem: DropdownMenuItem = {
    label: 'なし',
    icon: !currentId ? 'i-lucide-check' : 'i-lucide-x',
    class: !currentId ? 'bg-elevated/80 font-semibold' : '',
    onSelect: () => { draft.value[fieldName] = null }
  }
  return [items, [noneItem]]
}

const assigneeItems = computed(() => buildMemberItems(draft.value.assigneeMemberId, 'assigneeMemberId', false))
const requesterItems = computed(() => buildMemberItems(draft.value.requesterMemberId, 'requesterMemberId', true))

const departmentItems = computed<DropdownMenuItem[][]>(() => {
  const items: DropdownMenuItem[] = props.departments.map((d) => {
    const isCurrent = d.code === draft.value.requestingDeptCode
    return {
      label: d.name,
      icon: isCurrent ? 'i-lucide-check' : 'i-lucide-building-2',
      class: isCurrent ? 'bg-elevated/80 font-semibold' : '',
      onSelect: () => { draft.value.requestingDeptCode = d.code }
    }
  })
  const noneItem: DropdownMenuItem = {
    label: 'なし',
    icon: draft.value.requestingDeptCode === null ? 'i-lucide-check' : 'i-lucide-x',
    class: draft.value.requestingDeptCode === null ? 'bg-elevated/80 font-semibold' : '',
    onSelect: () => { draft.value.requestingDeptCode = null }
  }
  return [items, [noneItem]]
})

function toggleTag(tagCode: string, enabled: boolean) {
  draft.value.tagCodes = enabled
    ? [...draft.value.tagCodes, tagCode]
    : draft.value.tagCodes.filter(c => c !== tagCode)
}
</script>

<template>
  <USlideover
    :open="open"
    title="新規タスク"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4 p-1">
        <div>
          <p class="text-xs text-muted mb-1">
            内容 <span class="text-error">*</span>
          </p>
          <UInput
            v-model="draft.content"
            placeholder="タスクの概要"
            autofocus
            class="w-full"
          />
        </div>

        <div>
          <p class="text-xs text-muted mb-1">
            説明
          </p>
          <UTextarea
            v-model="draft.description"
            :rows="4"
            autoresize
            placeholder="詳細を記入"
            class="w-full"
          />
        </div>

        <USeparator />

        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">
              ステータス <span class="text-error">*</span>
            </p>
            <UDropdownMenu :items="statusItems">
              <UBadge
                v-if="statusMap[draft.statusCode]"
                :color="statusMap[draft.statusCode]!.color"
                variant="subtle"
                :label="statusMap[draft.statusCode]!.label"
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
                v-if="draft.priorityCode && priorityMap[draft.priorityCode]"
                :color="priorityMap[draft.priorityCode]!.color"
                variant="subtle"
                :label="priorityMap[draft.priorityCode]!.label"
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
              担当者 <span class="text-error">*</span>
            </p>
            <UDropdownMenu :items="assigneeItems">
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{ draft.assigneeMemberId ? (memberMap[draft.assigneeMemberId]?.displayName ?? '—') : '選択してください' }}
              </button>
            </UDropdownMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              期限
            </p>
            <UPopover>
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ draft.deadline ?? '—' }}
              </button>
              <template #content>
                <div class="p-2 space-y-2">
                  <UCalendar
                    :model-value="isoToCalendarDate(draft.deadline)"
                    locale="ja"
                    @update:model-value="(d: DateValue | null) => draft.deadline = calendarDateToIso(d)"
                  />
                  <UButton
                    v-if="draft.deadline"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    block
                    label="クリア"
                    @click="draft.deadline = null"
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
                {{ draft.requestingDeptCode ? (departmentMap[draft.requestingDeptCode]?.name ?? '—') : '—' }}
              </button>
            </UDropdownMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              依頼者
            </p>
            <UDropdownMenu :items="requesterItems">
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{ draft.requesterMemberId ? (memberMap[draft.requesterMemberId]?.displayName ?? '—') : '—' }}
              </button>
            </UDropdownMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">
              完了予定日
            </p>
            <UPopover>
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ draft.plannedCompletionDate ?? '—' }}
              </button>
              <template #content>
                <div class="p-2 space-y-2">
                  <UCalendar
                    :model-value="isoToCalendarDate(draft.plannedCompletionDate)"
                    locale="ja"
                    @update:model-value="(d: DateValue | null) => draft.plannedCompletionDate = calendarDateToIso(d)"
                  />
                  <UButton
                    v-if="draft.plannedCompletionDate"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    block
                    label="クリア"
                    @click="draft.plannedCompletionDate = null"
                  />
                </div>
              </template>
            </UPopover>
          </div>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">
            タグ
          </p>
          <UPopover>
            <button class="flex flex-wrap gap-1 cursor-pointer min-w-12">
              <UBadge
                v-for="code in draft.tagCodes"
                :key="code"
                :color="tags.find(t => t.code === code)?.color ?? 'neutral'"
                variant="soft"
                :label="tags.find(t => t.code === code)?.name ?? code"
              />
              <UBadge
                v-if="draft.tagCodes.length === 0"
                color="neutral"
                variant="outline"
                label="+ タグ"
              />
            </button>
            <template #content>
              <div class="p-2 space-y-1 min-w-48">
                <label
                  v-for="t in tags"
                  :key="t.code"
                  class="flex items-center gap-2 px-2 py-1 hover:bg-elevated/40 rounded cursor-pointer"
                >
                  <UCheckbox
                    :model-value="draft.tagCodes.includes(t.code)"
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
            Trello URL
          </p>
          <UInput
            :model-value="draft.trelloUrl ?? ''"
            type="url"
            placeholder="https://trello.com/c/..."
            class="w-full"
            @update:model-value="(v: string) => draft.trelloUrl = v.trim() || null"
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
        <UButton
          color="primary"
          icon="i-lucide-plus"
          :loading="submitting"
          :disabled="!canSubmit"
          label="作成"
          @click="submit"
        />
      </div>
    </template>
  </USlideover>
</template>
