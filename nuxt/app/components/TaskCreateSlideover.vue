<script setup lang="ts">
import { createTask } from '~/api/tasks'
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
  created: [Task]
}>()

type Draft = Omit<Task, 'id' | 'projectId' | 'createdAt'>

const makeInitialDraft = (): Draft => ({
  content: '',
  description: '',
  links: [],
  requesterMemberId: props.currentMemberId,
  requestingDeptCode: null,
  assigneeMemberId: props.currentMemberId ?? '',
  priorityCode: null,
  statusCode: props.statuses[0]?.code ?? '',
  deadline: null,
  plannedCompletionDate: null,
  tagCodes: []
})

const draft = ref<Draft>(makeInitialDraft())
const submitting = ref(false)

const addLink = () => {
  draft.value.links.push({ label: '', url: '' })
}

const removeLink = (index: number) => {
  draft.value.links.splice(index, 1)
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      draft.value = makeInitialDraft()
    }
  }
)

const canSubmit = computed(() =>
  Boolean(draft.value.content.trim() && draft.value.assigneeMemberId && draft.value.statusCode)
)

const submit = async () => {
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

const statusMap = computed(() => Object.fromEntries(props.statuses.map((s) => [s.code, s])))
const priorityMap = computed(() => Object.fromEntries(props.priorities.map((p) => [p.code, p])))
const memberMap = computed(() => Object.fromEntries(props.members.map((m) => [m.id, m])))
const departmentMap = computed(() => Object.fromEntries(props.departments.map((d) => [d.code, d])))

const statusSelectItems = computed(() =>
  [...props.statuses]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ value: s.code, label: s.label }))
)

const prioritySelectItems = computed(() =>
  [...props.priorities]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ value: p.code, label: p.label }))
)

const memberSelectItems = computed(() =>
  props.members.map((m) => ({ value: m.id, label: m.displayName }))
)

const departmentSelectItems = computed(() =>
  props.departments.map((d) => ({ value: d.code, label: d.name }))
)
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
          <p class="text-xs text-muted mb-1">内容 <span class="text-error">*</span></p>
          <UInput v-model="draft.content" placeholder="タスクの概要" autofocus class="w-full" />
        </div>

        <div>
          <p class="text-xs text-muted mb-1">説明</p>
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
            <p class="text-xs text-muted mb-1">ステータス <span class="text-error">*</span></p>
            <SelectMenu
              :items="statusSelectItems"
              :current="draft.statusCode"
              default-icon="i-lucide-circle-dashed"
              @select="(c: string | null) => c && (draft.statusCode = c)"
            >
              <UBadge
                v-if="statusMap[draft.statusCode]"
                :color="statusMap[draft.statusCode]!.color"
                variant="subtle"
                :label="statusMap[draft.statusCode]!.label"
                class="cursor-pointer hover:opacity-80"
              />
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">優先度</p>
            <SelectMenu
              :items="prioritySelectItems"
              :current="draft.priorityCode"
              allow-none
              default-icon="i-lucide-flag"
              @select="(c: string | null) => (draft.priorityCode = c)"
            >
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
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">担当者 <span class="text-error">*</span></p>
            <SelectMenu
              :items="memberSelectItems"
              :current="draft.assigneeMemberId || null"
              default-icon="i-lucide-user"
              @select="(c: string | null) => c && (draft.assigneeMemberId = c)"
            >
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{
                  draft.assigneeMemberId
                    ? (memberMap[draft.assigneeMemberId]?.displayName ?? '—')
                    : '選択してください'
                }}
              </button>
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">期限</p>
            <DatePopover
              :model-value="draft.deadline"
              @update:model-value="(v: string | null) => (draft.deadline = v)"
            >
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ draft.deadline ?? '—' }}
              </button>
            </DatePopover>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">依頼部署</p>
            <SelectMenu
              :items="departmentSelectItems"
              :current="draft.requestingDeptCode"
              allow-none
              default-icon="i-lucide-building-2"
              @select="(c: string | null) => (draft.requestingDeptCode = c)"
            >
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{
                  draft.requestingDeptCode
                    ? (departmentMap[draft.requestingDeptCode]?.name ?? '—')
                    : '—'
                }}
              </button>
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">依頼者</p>
            <SelectMenu
              :items="memberSelectItems"
              :current="draft.requesterMemberId"
              allow-none
              default-icon="i-lucide-user"
              @select="(c: string | null) => (draft.requesterMemberId = c)"
            >
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{
                  draft.requesterMemberId
                    ? (memberMap[draft.requesterMemberId]?.displayName ?? '—')
                    : '—'
                }}
              </button>
            </SelectMenu>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">完了予定日</p>
            <DatePopover
              :model-value="draft.plannedCompletionDate"
              @update:model-value="(v: string | null) => (draft.plannedCompletionDate = v)"
            >
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ draft.plannedCompletionDate ?? '—' }}
              </button>
            </DatePopover>
          </div>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">タグ</p>
          <TagPicker
            :tags="tags"
            :selected="draft.tagCodes"
            @update:selected="(codes: string[]) => (draft.tagCodes = codes)"
          >
            <button class="flex flex-wrap gap-1 cursor-pointer min-w-12">
              <UBadge
                v-for="code in draft.tagCodes"
                :key="code"
                :color="tags.find((t) => t.code === code)?.color ?? 'neutral'"
                variant="soft"
                :label="tags.find((t) => t.code === code)?.name ?? code"
              />
              <UBadge
                v-if="draft.tagCodes.length === 0"
                color="neutral"
                variant="outline"
                label="+ タグ"
              />
            </button>
          </TagPicker>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">リンク</p>
          <div class="space-y-1">
            <div v-for="(link, i) in draft.links" :key="i" class="flex items-center gap-2">
              <UInput v-model="link.label" placeholder="ラベル" class="w-32" />
              <UInput v-model="link.url" placeholder="https://..." class="flex-1" />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="removeLink(i)"
              />
            </div>
          </div>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-plus"
            label="リンクを追加"
            class="mt-1"
            @click="addLink"
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
