<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { Row } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import { updateTask } from '~/api/tasks'
import type { Task } from '~/types/task'

const UButton = resolveComponent('UButton')

const currentProjectId = useCurrentProjectId()
const currentUserId = useCurrentUserId()

const { data: tasks, refresh: refreshTasks } = await useTasks(currentProjectId)
const { data: statuses } = await useTaskStatuses(currentProjectId)
const { data: priorities } = await useTaskPriorities(currentProjectId)
const { data: tags } = await useTags(currentProjectId)
const { data: members } = await useMembers(currentProjectId)
const { data: departments } = await useDepartments()

const currentMemberId = computed<string | null>(
  () => members.value.find((m) => m.userId === currentUserId.value)?.id ?? null
)

const statusMap = computed(() => Object.fromEntries(statuses.value.map((s) => [s.code, s])))
const priorityMap = computed(() => Object.fromEntries(priorities.value.map((p) => [p.code, p])))
const tagMap = computed(() => Object.fromEntries(tags.value.map((t) => [t.code, t])))
const memberMap = computed(() => Object.fromEntries(members.value.map((m) => [m.id, m])))
const departmentMap = computed(() => Object.fromEntries(departments.value.map((d) => [d.code, d])))

const search = ref('')
const statusFilter = ref<string>('')
const priorityFilter = ref<string>('')
const assigneeFilter = ref<string>('')

const statusSelectItems = computed(() =>
  statuses.value.map((s) => ({ label: s.label, value: s.code }))
)
const prioritySelectItems = computed(() =>
  priorities.value.map((p) => ({ label: p.label, value: p.code }))
)
const memberSelectItems = computed(() =>
  members.value.map((m) => ({ label: m.displayName, value: m.id }))
)

const hasActiveFilter = computed(() =>
  Boolean(search.value || statusFilter.value || priorityFilter.value || assigneeFilter.value)
)

const resetFilters = () => {
  search.value = ''
  statusFilter.value = ''
  priorityFilter.value = ''
  assigneeFilter.value = ''
}

const slideoverOpen = ref(false)
const createSlideoverOpen = ref(false)
const selectedTaskId = ref<number | null>(null)

const toast = useToast()

const onTaskCreated = async (task: Task) => {
  await refreshTasks()
  toast.add({
    title: 'タスクを作成しました',
    description: `#${task.id} ${task.content}`,
    color: 'success',
    icon: 'i-lucide-check'
  })
  selectedTaskId.value = task.id
  slideoverOpen.value = true
}

const selectedTask = computed<Task | null>(() =>
  selectedTaskId.value !== null
    ? (tasks.value.find((t) => t.id === selectedTaskId.value) ?? null)
    : null
)

watch(currentProjectId, () => {
  resetFilters()
  slideoverOpen.value = false
  selectedTaskId.value = null
})

const openTask = (task: Task) => {
  selectedTaskId.value = task.id
  slideoverOpen.value = true
}

const filteredTasks = computed(() => {
  return tasks.value.filter((t) => {
    if (search.value && !t.content.toLowerCase().includes(search.value.toLowerCase())) return false
    if (statusFilter.value && t.statusCode !== statusFilter.value) return false
    if (priorityFilter.value && t.priorityCode !== priorityFilter.value) return false
    if (assigneeFilter.value && t.assigneeMemberId !== assigneeFilter.value) return false
    return true
  })
})

const sorting = ref<{ id: string; desc: boolean }[]>([{ id: 'id', desc: false }])

const sortHeader = (label: string) => {
  return ({
    column
  }: {
    column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc: boolean) => void }
  }) => {
    const sorted = column.getIsSorted()
    return h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      label,
      class: '-mx-2.5 data-[state=open]:bg-elevated',
      icon:
        sorted === 'asc'
          ? 'i-lucide-arrow-up'
          : sorted === 'desc'
            ? 'i-lucide-arrow-down'
            : 'i-lucide-arrow-up-down',
      onClick: () => column.toggleSorting(sorted === 'asc')
    })
  }
}

const columns: TableColumn<Task>[] = [
  { accessorKey: 'id', header: sortHeader('No') },
  { accessorKey: 'content', header: sortHeader('内容') },
  {
    accessorKey: 'assigneeMemberId',
    header: sortHeader('担当者'),
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const na = memberMap.value[a.original.assigneeMemberId]?.displayName ?? ''
      const nb = memberMap.value[b.original.assigneeMemberId]?.displayName ?? ''
      return na.localeCompare(nb, 'ja')
    }
  },
  {
    accessorKey: 'statusCode',
    header: sortHeader('ステータス'),
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const oa = statusMap.value[a.original.statusCode]?.order ?? 999
      const ob = statusMap.value[b.original.statusCode]?.order ?? 999
      return oa - ob
    }
  },
  {
    accessorKey: 'priorityCode',
    header: sortHeader('優先度'),
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const oa = a.original.priorityCode
        ? (priorityMap.value[a.original.priorityCode]?.order ?? 999)
        : 999
      const ob = b.original.priorityCode
        ? (priorityMap.value[b.original.priorityCode]?.order ?? 999)
        : 999
      return oa - ob
    }
  },
  { accessorKey: 'tagCodes', header: 'タグ', enableSorting: false },
  {
    accessorKey: 'deadline',
    header: sortHeader('期限'),
    sortingFn: (a: Row<Task>, b: Row<Task>) => {
      const da = a.original.deadline ?? '9999-12-31'
      const db = b.original.deadline ?? '9999-12-31'
      return da.localeCompare(db)
    }
  }
]

const updateTaskField = async (
  taskId: number,
  patch: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>
) => {
  await updateTask(currentProjectId.value, taskId, patch)
  await refreshTasks()
}
</script>

<template>
  <UDashboardPanel id="tasks">
    <template #header>
      <UDashboardNavbar title="タスク一覧" icon="i-lucide-list-checks">
        <template #right>
          <UButton
            color="primary"
            icon="i-lucide-plus"
            label="新規タスク"
            @click="createSlideoverOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-default">
        <UInput v-model="search" placeholder="内容を検索" icon="i-lucide-search" class="min-w-64" />
        <USelect
          v-model="statusFilter"
          :items="statusSelectItems"
          value-key="value"
          placeholder="すべてのステータス"
          class="w-44"
        />
        <USelect
          v-model="priorityFilter"
          :items="prioritySelectItems"
          value-key="value"
          placeholder="すべての優先度"
          class="w-40"
        />
        <USelect
          v-model="assigneeFilter"
          :items="memberSelectItems"
          value-key="value"
          placeholder="すべての担当者"
          class="w-44"
        />
        <UButton
          v-if="hasActiveFilter"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          label="クリア"
          @click="resetFilters"
        />
        <span class="ml-auto text-sm text-muted">
          {{ filteredTasks.length }} / {{ tasks.length }} 件
        </span>
      </div>

      <UTable
        v-model:sorting="sorting"
        :data="filteredTasks"
        :columns="columns"
        :ui="{ td: 'align-top py-2' }"
      >
        <template #id-cell="{ row }">
          <button
            class="font-mono text-xs text-muted hover:text-default"
            @click="openTask(row.original)"
          >
            #{{ row.original.id }}
          </button>
        </template>

        <template #content-cell="{ row }">
          <button class="text-left hover:underline" @click="openTask(row.original)">
            {{ row.original.content }}
          </button>
        </template>

        <template #assigneeMemberId-cell="{ row }">
          <SelectMenu
            :items="memberSelectItems"
            :current="row.original.assigneeMemberId"
            default-icon="i-lucide-user"
            @select="
              (c: string | null) => c && updateTaskField(row.original.id, { assigneeMemberId: c })
            "
          >
            <button class="text-sm hover:underline cursor-pointer">
              {{ memberMap[row.original.assigneeMemberId]?.displayName ?? '—' }}
            </button>
          </SelectMenu>
        </template>

        <template #statusCode-cell="{ row }">
          <SelectMenu
            v-if="statusMap[row.original.statusCode]"
            :items="statusSelectItems"
            :current="row.original.statusCode"
            default-icon="i-lucide-circle-dashed"
            @select="(c: string | null) => c && updateTaskField(row.original.id, { statusCode: c })"
          >
            <UBadge
              :color="statusMap[row.original.statusCode]!.color"
              variant="subtle"
              :label="statusMap[row.original.statusCode]!.label"
              class="cursor-pointer hover:opacity-80"
            />
          </SelectMenu>
        </template>

        <template #priorityCode-cell="{ row }">
          <SelectMenu
            :items="prioritySelectItems"
            :current="row.original.priorityCode"
            allow-none
            default-icon="i-lucide-flag"
            @select="(c: string | null) => updateTaskField(row.original.id, { priorityCode: c })"
          >
            <UBadge
              v-if="row.original.priorityCode && priorityMap[row.original.priorityCode]"
              :color="priorityMap[row.original.priorityCode]!.color"
              variant="subtle"
              :label="priorityMap[row.original.priorityCode]!.label"
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
        </template>

        <template #tagCodes-cell="{ row }">
          <TagPicker
            :tags="tags"
            :selected="row.original.tagCodes"
            @update:selected="
              (codes: string[]) => updateTaskField(row.original.id, { tagCodes: codes })
            "
          >
            <button class="flex flex-wrap gap-1 cursor-pointer min-w-12">
              <UBadge
                v-for="code in row.original.tagCodes"
                :key="code"
                :color="tagMap[code]?.color ?? 'neutral'"
                variant="soft"
                size="sm"
                :label="tagMap[code]?.name ?? code"
              />
              <UBadge
                v-if="row.original.tagCodes.length === 0"
                color="neutral"
                variant="outline"
                label="+ タグ"
                size="sm"
              />
            </button>
          </TagPicker>
        </template>

        <template #deadline-cell="{ row }">
          <DatePopover
            :model-value="row.original.deadline"
            @update:model-value="
              (v: string | null) => updateTaskField(row.original.id, { deadline: v })
            "
          >
            <button class="text-sm tabular-nums hover:underline cursor-pointer min-w-16 text-left">
              {{ row.original.deadline ?? '—' }}
            </button>
          </DatePopover>
        </template>
      </UTable>
    </template>
  </UDashboardPanel>

  <TaskDetailSlideover
    v-model:open="slideoverOpen"
    :task="selectedTask"
    :current-member-id="currentMemberId"
    :status-map="statusMap"
    :priority-map="priorityMap"
    :member-map="memberMap"
    :tag-map="tagMap"
    :department-map="departmentMap"
    @change-field="
      (patch: Partial<Task>) => selectedTask && updateTaskField(selectedTask.id, patch)
    "
  />

  <TaskCreateSlideover
    v-model:open="createSlideoverOpen"
    :project-id="currentProjectId"
    :current-member-id="currentMemberId"
    :statuses="statuses"
    :priorities="priorities"
    :tags="tags"
    :members="members"
    :departments="departments"
    @created="onTaskCreated"
  />
</template>
