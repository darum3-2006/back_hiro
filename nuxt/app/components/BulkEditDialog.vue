<script setup lang="ts">
import type { BulkUpdateTasksInput } from '~/api/tasks';
import type { Flag, Tag, TaskPriority, TaskStatus } from '~/types/master';
import type { Member } from '~/types/member';
import { fmtDate } from '~/utils/date';

/** ids を除いた一括編集パッチ（親で ids を足して API へ渡す） */
type BulkEditPatch = Omit<BulkUpdateTasksInput, 'ids'>;

const props = defineProps<{
  open: boolean;
  /** 対象タスク件数 */
  count: number;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  members: Member[];
  tags: Tag[];
  flags: Flag[];
  /** 適用中（API 実行中）。確認ボタンの loading に使う */
  applying?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  apply: [BulkEditPatch];
}>();

const step = ref<'edit' | 'confirm'>('edit');

// 各項目の「変更する」フラグ。チェックされた項目だけをパッチに含める。
const enableStatus = ref(false);
const enableAssignee = ref(false);
const enablePriority = ref(false);
const enableDeadline = ref(false);
const enablePlannedStart = ref(false);
const enablePlannedCompletion = ref(false);
const enableTags = ref(false);
const enableFlags = ref(false);

// 入力値。undefined = 未選択（適用不可）、null = 明示的に「なし / 未設定」
const statusCode = ref<string | undefined>(undefined);
const assigneeMemberId = ref<string | null | undefined>(undefined);
const priorityCode = ref<string | null | undefined>(undefined);
const deadline = ref<string | null | undefined>(undefined);
const plannedStartDate = ref<string | null | undefined>(undefined);
const plannedCompletionDate = ref<string | null | undefined>(undefined);
const tagMode = ref<'add' | 'remove'>('add');
const tagCodes = ref<string[]>([]);
const flagMode = ref<'add' | 'remove'>('add');
const flagCodes = ref<string[]>([]);

const reset = () => {
  step.value = 'edit';
  enableStatus.value = false;
  enableAssignee.value = false;
  enablePriority.value = false;
  enableDeadline.value = false;
  enablePlannedStart.value = false;
  enablePlannedCompletion.value = false;
  enableTags.value = false;
  enableFlags.value = false;
  statusCode.value = undefined;
  assigneeMemberId.value = undefined;
  priorityCode.value = undefined;
  deadline.value = undefined;
  plannedStartDate.value = undefined;
  plannedCompletionDate.value = undefined;
  tagMode.value = 'add';
  tagCodes.value = [];
  flagMode.value = 'add';
  flagCodes.value = [];
};

watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
);

const statusItems = computed(() => props.statuses.map((s) => ({ label: s.label, value: s.code })));
const priorityItems = computed(() =>
  props.priorities.map((p) => ({ label: p.label, value: p.code })),
);
// 一括編集の対象フィールドは担当者のみなので、readonly ユーザー紐づきメンバーを除外する
const memberItems = computed(() =>
  assignableMembers(props.members).map((m) => ({ label: m.displayName, value: m.id })),
);

const statusLabel = computed(
  () => props.statuses.find((s) => s.code === statusCode.value)?.label ?? '',
);
const assigneeLabel = computed(() => {
  if (assigneeMemberId.value === undefined) return '';
  if (assigneeMemberId.value === null) return '担当者なし';
  return props.members.find((m) => m.id === assigneeMemberId.value)?.displayName ?? '';
});
const priorityLabel = computed(() => {
  if (priorityCode.value === undefined) return '';
  if (priorityCode.value === null) return 'なし';
  return props.priorities.find((p) => p.code === priorityCode.value)?.label ?? '';
});
const dateText = (v: string | null | undefined): string =>
  v === undefined ? '' : v === null ? '未設定' : fmtDate(v);

// 有効な項目それぞれに値が入っているか
const statusOk = computed(() => !enableStatus.value || Boolean(statusCode.value));
const assigneeOk = computed(() => !enableAssignee.value || assigneeMemberId.value !== undefined);
const priorityOk = computed(() => !enablePriority.value || priorityCode.value !== undefined);
const deadlineOk = computed(() => !enableDeadline.value || deadline.value !== undefined);
const plannedStartOk = computed(
  () => !enablePlannedStart.value || plannedStartDate.value !== undefined,
);
const plannedCompletionOk = computed(
  () => !enablePlannedCompletion.value || plannedCompletionDate.value !== undefined,
);
const tagsOk = computed(() => !enableTags.value || tagCodes.value.length > 0);
const flagsOk = computed(() => !enableFlags.value || flagCodes.value.length > 0);

const anyEnabled = computed(
  () =>
    enableStatus.value ||
    enableAssignee.value ||
    enablePriority.value ||
    enableDeadline.value ||
    enablePlannedStart.value ||
    enablePlannedCompletion.value ||
    enableTags.value ||
    enableFlags.value,
);

const canApply = computed(
  () =>
    anyEnabled.value &&
    statusOk.value &&
    assigneeOk.value &&
    priorityOk.value &&
    deadlineOk.value &&
    plannedStartOk.value &&
    plannedCompletionOk.value &&
    tagsOk.value &&
    flagsOk.value,
);

const summaryLines = computed<string[]>(() => {
  const lines: string[] = [];
  if (enableStatus.value) lines.push(`ステータス → 「${statusLabel.value}」`);
  if (enableAssignee.value) {
    lines.push(`担当者 → 「${assigneeMemberId.value === null ? '未設定' : assigneeLabel.value}」`);
  }
  if (enablePriority.value) {
    lines.push(`優先度 → 「${priorityCode.value === null ? 'なし' : priorityLabel.value}」`);
  }
  if (enableDeadline.value) lines.push(`期限 → 「${dateText(deadline.value)}」`);
  if (enablePlannedStart.value) {
    lines.push(`着手予定日 → 「${dateText(plannedStartDate.value)}」`);
  }
  if (enablePlannedCompletion.value) {
    lines.push(`完了予定日 → 「${dateText(plannedCompletionDate.value)}」`);
  }
  if (enableTags.value) {
    const names = tagCodes.value.map((c) => props.tags.find((t) => t.code === c)?.name ?? c);
    lines.push(`タグ「${names.join('」「')}」を${tagMode.value === 'add' ? '追加' : '削除'}`);
  }
  if (enableFlags.value) {
    const names = flagCodes.value.map((c) => props.flags.find((f) => f.code === c)?.name ?? c);
    lines.push(`フラグ「${names.join('」「')}」を${flagMode.value === 'add' ? '追加' : '削除'}`);
  }
  return lines;
});

const buildPatch = (): BulkEditPatch => {
  const patch: BulkEditPatch = {};
  if (enableStatus.value) patch.statusCode = statusCode.value;
  if (enableAssignee.value) patch.assigneeMemberId = assigneeMemberId.value as string | null;
  if (enablePriority.value) patch.priorityCode = priorityCode.value as string | null;
  if (enableDeadline.value) patch.deadline = deadline.value as string | null;
  if (enablePlannedStart.value) patch.plannedStartDate = plannedStartDate.value as string | null;
  if (enablePlannedCompletion.value) {
    patch.plannedCompletionDate = plannedCompletionDate.value as string | null;
  }
  if (enableTags.value) {
    if (tagMode.value === 'add') patch.addTagCodes = [...tagCodes.value];
    else patch.removeTagCodes = [...tagCodes.value];
  }
  if (enableFlags.value) {
    if (flagMode.value === 'add') patch.addFlagCodes = [...flagCodes.value];
    else patch.removeFlagCodes = [...flagCodes.value];
  }
  return patch;
};

const goConfirm = () => {
  if (canApply.value) step.value = 'confirm';
};
const back = () => {
  step.value = 'edit';
};
const confirmApply = () => {
  emit('apply', buildPatch());
};

const toggleTag = (code: string, on: boolean) => {
  tagCodes.value = on ? [...tagCodes.value, code] : tagCodes.value.filter((c) => c !== code);
};
const toggleFlag = (code: string, on: boolean) => {
  flagCodes.value = on ? [...flagCodes.value, code] : flagCodes.value.filter((c) => c !== code);
};

const modeItems = [
  { label: '追加', value: 'add' as const },
  { label: '削除', value: 'remove' as const },
];
</script>

<template>
  <AppModal
    :open="open"
    title="タスクの一括編集"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <!-- 入力ステップ -->
      <div v-if="step === 'edit'" class="space-y-3 text-sm">
        <p class="text-muted">
          <span class="font-semibold text-default">{{ count }}</span>
          件のタスクに、チェックした項目をまとめて適用します。
        </p>

        <div class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <!-- ステータス -->
          <div>
            <UCheckbox v-model="enableStatus" label="ステータス" />
            <div v-if="enableStatus" class="mt-1.5 pl-6">
              <SelectMenu
                :items="statusItems"
                :current="statusCode ?? null"
                default-icon="i-lucide-circle-dashed"
                @select="(c: string | null) => (statusCode = c ?? undefined)"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  trailing-icon="i-lucide-chevron-down"
                  class="w-full justify-between"
                  :label="statusLabel || 'ステータスを選択…'"
                />
              </SelectMenu>
            </div>
          </div>

          <!-- 担当者 -->
          <div>
            <UCheckbox v-model="enableAssignee" label="担当者" />
            <div v-if="enableAssignee" class="mt-1.5 pl-6">
              <SelectMenu
                :items="memberItems"
                :current="assigneeMemberId === undefined ? null : assigneeMemberId"
                allow-none
                none-label="担当者なし"
                default-icon="i-lucide-user"
                searchable
                search-placeholder="名前で検索…"
                @select="(c: string | null) => (assigneeMemberId = c)"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  trailing-icon="i-lucide-chevron-down"
                  class="w-full justify-between"
                  :label="assigneeLabel || '担当者を選択…'"
                />
              </SelectMenu>
            </div>
          </div>

          <!-- 優先度 -->
          <div>
            <UCheckbox v-model="enablePriority" label="優先度" />
            <div v-if="enablePriority" class="mt-1.5 pl-6">
              <SelectMenu
                :items="priorityItems"
                :current="priorityCode === undefined ? null : priorityCode"
                allow-none
                none-label="なし"
                default-icon="i-lucide-flag"
                @select="(c: string | null) => (priorityCode = c)"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  trailing-icon="i-lucide-chevron-down"
                  class="w-full justify-between"
                  :label="priorityLabel || '優先度を選択…'"
                />
              </SelectMenu>
            </div>
          </div>

          <!-- 期限 -->
          <div>
            <UCheckbox v-model="enableDeadline" label="期限" />
            <div v-if="enableDeadline" class="mt-1.5 flex items-center gap-2 pl-6">
              <DatePopover
                :model-value="typeof deadline === 'string' ? deadline : null"
                @update:model-value="(v: string | null) => (deadline = v)"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  :label="deadline ? dateText(deadline) : '日付を選択…'"
                />
              </DatePopover>
              <UButton
                color="neutral"
                variant="ghost"
                label="未設定にする"
                :class="deadline === null ? 'ring-1 ring-primary' : ''"
                @click="deadline = null"
              />
            </div>
          </div>

          <!-- 着手予定日 -->
          <div>
            <UCheckbox v-model="enablePlannedStart" label="着手予定日" />
            <div v-if="enablePlannedStart" class="mt-1.5 flex items-center gap-2 pl-6">
              <DatePopover
                :model-value="typeof plannedStartDate === 'string' ? plannedStartDate : null"
                @update:model-value="(v: string | null) => (plannedStartDate = v)"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  :label="plannedStartDate ? dateText(plannedStartDate) : '日付を選択…'"
                />
              </DatePopover>
              <UButton
                color="neutral"
                variant="ghost"
                label="未設定にする"
                :class="plannedStartDate === null ? 'ring-1 ring-primary' : ''"
                @click="plannedStartDate = null"
              />
            </div>
          </div>

          <!-- 完了予定日 -->
          <div>
            <UCheckbox v-model="enablePlannedCompletion" label="完了予定日" />
            <div v-if="enablePlannedCompletion" class="mt-1.5 flex items-center gap-2 pl-6">
              <DatePopover
                :model-value="
                  typeof plannedCompletionDate === 'string' ? plannedCompletionDate : null
                "
                @update:model-value="(v: string | null) => (plannedCompletionDate = v)"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  :label="plannedCompletionDate ? dateText(plannedCompletionDate) : '日付を選択…'"
                />
              </DatePopover>
              <UButton
                color="neutral"
                variant="ghost"
                label="未設定にする"
                :class="plannedCompletionDate === null ? 'ring-1 ring-primary' : ''"
                @click="plannedCompletionDate = null"
              />
            </div>
          </div>

          <!-- タグ -->
          <div>
            <UCheckbox v-model="enableTags" label="タグ" />
            <div v-if="enableTags" class="mt-1.5 space-y-2 pl-6">
              <URadioGroup v-model="tagMode" :items="modeItems" orientation="horizontal" />
              <div class="max-h-40 overflow-y-auto rounded-md border border-default p-2 space-y-1">
                <label
                  v-for="t in tags"
                  :key="t.code"
                  class="flex items-center gap-2 px-2 py-1 hover:bg-elevated/40 rounded cursor-pointer"
                >
                  <UCheckbox
                    :model-value="tagCodes.includes(t.code)"
                    @update:model-value="
                      (v: boolean | 'indeterminate') => toggleTag(t.code, v === true)
                    "
                  />
                  <UBadge :color="t.color" variant="soft" size="sm" :label="t.name" />
                </label>
                <p v-if="tags.length === 0" class="text-xs text-muted px-2 py-1">
                  タグがありません
                </p>
              </div>
            </div>
          </div>

          <!-- フラグ -->
          <div>
            <UCheckbox v-model="enableFlags" label="フラグ" />
            <div v-if="enableFlags" class="mt-1.5 space-y-2 pl-6">
              <URadioGroup v-model="flagMode" :items="modeItems" orientation="horizontal" />
              <div class="max-h-40 overflow-y-auto rounded-md border border-default p-2 space-y-1">
                <label
                  v-for="f in flags"
                  :key="f.code"
                  class="flex items-center gap-2 px-2 py-1 hover:bg-elevated/40 rounded cursor-pointer"
                >
                  <UCheckbox
                    :model-value="flagCodes.includes(f.code)"
                    @update:model-value="
                      (v: boolean | 'indeterminate') => toggleFlag(f.code, v === true)
                    "
                  />
                  <UBadge :color="f.color" variant="soft" size="sm" :label="f.name" />
                </label>
                <p v-if="flags.length === 0" class="text-xs text-muted px-2 py-1">
                  フラグがありません
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 確認ステップ -->
      <div v-else class="space-y-3 text-sm">
        <p>
          <span class="font-semibold">{{ count }}</span>
          件のタスクに、次の変更をまとめて適用します。
        </p>
        <ul class="rounded-md bg-elevated/40 px-4 py-2 space-y-1 list-disc list-inside">
          <li v-for="line in summaryLines" :key="line">{{ line }}</li>
        </ul>
        <p class="text-xs text-muted">この操作は各タスクの履歴に記録され、通知が送られます。</p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <template v-if="step === 'edit'">
          <UButton
            color="neutral"
            variant="ghost"
            label="キャンセル"
            @click="emit('update:open', false)"
          />
          <UButton color="primary" label="確認へ" :disabled="!canApply" @click="goConfirm" />
        </template>
        <template v-else>
          <UButton
            color="neutral"
            variant="ghost"
            label="戻る"
            :disabled="applying"
            @click="back"
          />
          <UButton color="primary" label="適用" :loading="applying" @click="confirmApply" />
        </template>
      </div>
    </template>
  </AppModal>
</template>
