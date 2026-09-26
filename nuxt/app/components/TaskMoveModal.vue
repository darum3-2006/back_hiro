<script setup lang="ts">
import { apiMoveTask, apiPreviewTaskMove } from '~/api/task-move';
import type { Project } from '~/types/project';
import type { Task } from '~/types/task';
import type { TaskMovePreview } from '~/types/task-move';

/**
 * タスクを別のプロジェクトへ移すダイアログ（設計: docs/TASK_MOVE.md）。
 *
 * 移動は元に戻せないので、移動先を選ぶとサーバに事前確認を問い合わせ、付け替えの初期値と
 * 失われるものを受け取って並べる。確認のチェックを入れるまで「移動」は押せない。
 */
const props = defineProps<{
  open: boolean;
  task: Task;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
}>();

const api = useApi();
const toast = useToast();
const currentTenantKey = useCurrentTenantKey();
// プロジェクト一覧はレイアウトが読み込むので、ここでは取りに行かずキャッシュを読む
const { data: projects } = useNuxtData<Project[]>('projects');

/** 移動先の候補: 自分が編集できる（メンバーの）、アーカイブされていない、別のプロジェクト */
const targetItems = computed(() =>
  (projects.value ?? [])
    .filter((p) => p.canEdit && !p.archivedAt && p.id !== props.task.projectId)
    .map((p) => ({ value: p.id, label: p.name })),
);

const targetProjectId = ref<string | undefined>(undefined);
const preview = ref<TaskMovePreview | null>(null);
const loading = ref(false);
const moving = ref(false);
const confirmed = ref(false);

const NONE = '__none__';
const form = reactive({
  statusCode: '',
  priorityCode: NONE,
  assigneeMemberId: NONE,
  requesterMemberId: NONE,
});

// 開き直したら最初から（前に選んだ移動先や確認のチェックを持ち越さない）
watch(
  () => props.open,
  (v) => {
    if (!v) return;
    targetProjectId.value = undefined;
    preview.value = null;
    confirmed.value = false;
  },
);

watch(targetProjectId, async (to) => {
  preview.value = null;
  confirmed.value = false;
  if (!to) return;
  loading.value = true;
  try {
    const pv = await apiPreviewTaskMove(api, props.task.projectId, props.task.id, to);
    // 選び直しが間に合わなかった古い応答は捨てる
    if (targetProjectId.value !== to) return;
    preview.value = pv;
    form.statusCode = pv.defaults.statusCode;
    form.priorityCode = pv.defaults.priorityCode ?? NONE;
    form.assigneeMemberId = pv.defaults.assigneeMemberId ?? NONE;
    form.requesterMemberId = pv.defaults.requesterMemberId ?? NONE;
  } catch (e) {
    const message = (e as { data?: { message?: string } }).data?.message;
    toast.add({ title: '移動先を確認できませんでした', description: message, color: 'error' });
    targetProjectId.value = undefined;
  } finally {
    loading.value = false;
  }
});

const withNone = (items: { value: string; label: string }[], noneLabel: string) => [
  { value: NONE, label: noneLabel },
  ...items,
];

/**
 * 移動で失われるもの。サーバの事前確認（タグ・コメント等）と、ダイアログで選んだ値
 * （優先度・担当者・依頼者を「なし」にした等）を合わせて、実際に失われるものだけを並べる。
 */
const losses = computed<string[]>(() => {
  const pv = preview.value;
  if (!pv) return [];
  const list: string[] = [];
  const lostPerson = (label: string, name: string | null, chosen: string) => {
    if (name && chosen === NONE)
      list.push(`${label}「${name}」は移動先のメンバーでないため外れます`);
  };
  lostPerson('担当者', pv.source.assigneeName, form.assigneeMemberId);
  lostPerson('依頼者', pv.source.requesterName, form.requesterMemberId);
  if (pv.source.priorityLabel && form.priorityCode === NONE) {
    list.push(`優先度「${pv.source.priorityLabel}」は外れます`);
  }
  if (pv.tags.dropped.length) {
    list.push(`タグ「${pv.tags.dropped.join('」「')}」は移動先に無いため外れます`);
  }
  if (pv.flags.dropped.length) {
    list.push(`フラグ「${pv.flags.dropped.join('」「')}」は移動先に無いため外れます`);
  }
  for (const a of pv.comments.unknownAuthors) {
    list.push(
      `${a.name}さんのコメント ${a.count} 件は、投稿者が「不明」になります（移動先のメンバーでないため）`,
    );
  }
  if (pv.subtasks.droppedAssignees.length) {
    list.push(`サブタスクの担当者「${pv.subtasks.droppedAssignees.join('」「')}」は外れます`);
  }
  if (pv.subtasks.droppedFlags.length) {
    list.push(`サブタスクのフラグ「${pv.subtasks.droppedFlags.join('」「')}」は外れます`);
  }
  if (pv.relations.count > 0) {
    list.push(`関連タスク ${pv.relations.count} 件との関連が切れます`);
  }
  list.push(`番号 #${pv.task.seq} は移動先で振り直されます`);
  return list;
});

const canMove = computed(
  () => !!preview.value && !!form.statusCode && confirmed.value && !moving.value,
);

const move = async () => {
  const pv = preview.value;
  if (!pv || !canMove.value) return;
  moving.value = true;
  try {
    const orNull = (v: string) => (v === NONE ? null : v);
    const res = await apiMoveTask(api, props.task.projectId, props.task.id, {
      targetProjectId: pv.target.id,
      statusCode: form.statusCode,
      priorityCode: orNull(form.priorityCode),
      assigneeMemberId: orNull(form.assigneeMemberId),
      requesterMemberId: orNull(form.requesterMemberId),
    });
    toast.add({
      title: `${pv.target.name} へ移動しました`,
      description: `#${pv.task.seq} → #${res.seq}`,
      color: 'success',
      icon: 'i-lucide-check',
    });
    emit('update:open', false);
    // 移動元の一覧からは消えるので、移動先の一覧を開いて、移動したタスクの詳細を開く
    await navigateTo(`/${currentTenantKey.value}/projects/${res.projectId}/tasks?task=${res.seq}`);
  } catch (e) {
    const message = (e as { data?: { message?: string } }).data?.message;
    toast.add({ title: '移動できませんでした', description: message, color: 'error' });
  } finally {
    moving.value = false;
  }
};
</script>

<template>
  <AppModal
    :open="open"
    title="別のプロジェクトへ移動"
    :description="`#${task.seq} ${task.content}`"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="移動先のプロジェクト" required>
          <USelect
            v-model="targetProjectId"
            :items="targetItems"
            value-key="value"
            placeholder="選んでください"
            class="w-full"
          />
          <p v-if="targetItems.length === 0" class="mt-1 text-xs text-muted">
            移動できるプロジェクトがありません（自分がメンバーになっている、アーカイブされていない
            プロジェクトにだけ移せます）
          </p>
        </UFormField>

        <p v-if="loading" class="text-sm text-muted">移動先を確認しています…</p>

        <template v-if="preview">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="ステータス" required>
              <USelect
                v-model="form.statusCode"
                :items="preview.options.statuses"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="優先度">
              <USelect
                v-model="form.priorityCode"
                :items="withNone(preview.options.priorities, 'なし')"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="担当者">
              <USelect
                v-model="form.assigneeMemberId"
                :items="withNone(preview.options.assignees, '担当者なし')"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="依頼者">
              <USelect
                v-model="form.requesterMemberId"
                :items="withNone(preview.options.requesters, 'なし')"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="rounded-md border border-warning/40 bg-warning/10 p-3">
            <p class="flex items-center gap-1.5 text-sm font-medium text-warning">
              <UIcon name="i-lucide-triangle-alert" class="size-4" />
              移動すると元に戻せません
            </p>
            <ul class="mt-2 list-disc space-y-0.5 pl-5 text-sm">
              <li v-for="l in losses" :key="l">{{ l }}</li>
            </ul>
            <p class="mt-2 text-xs text-muted">
              コメント {{ preview.comments.count }} 件・サブタスク {{ preview.subtasks.count }} 件も
              一緒に移動します。共有リンクは移動後も開けます。
            </p>
          </div>

          <UCheckbox v-model="confirmed" label="元に戻せないことを確認しました" />
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="キャンセル"
          @click="emit('update:open', false)"
        />
        <UButton
          color="warning"
          icon="i-lucide-folder-input"
          label="移動する"
          :loading="moving"
          :disabled="!canMove"
          @click="move"
        />
      </div>
    </template>
  </AppModal>
</template>
