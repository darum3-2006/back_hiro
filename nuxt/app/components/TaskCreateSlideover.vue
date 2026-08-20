<script setup lang="ts">
import { apiCreateTask } from '~/api/tasks';
import type { Member } from '~/types/member';
import type { Department, Flag, Tag, TaskPriority, TaskStatus } from '~/types/master';
import type { Task, TaskLink } from '~/types/task';
import { resolveLinkLabelFromUrl } from '~/utils/link-label';

const api = useApi();

const props = defineProps<{
  open: boolean;
  projectId: string;
  currentMemberId: string | null;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  tags: Tag[];
  flags: Flag[];
  members: Member[];
  departments: Department[];
  /** 説明プレビューの #連番 リンク解決用（同プロジェクトの全タスク） */
  tasks?: Task[];
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  created: [Task];
}>();

// 作成画面で入力するフィールドのみ。サーバ側で割り当てる列は除外する。
type Draft = Omit<
  Task,
  | 'id'
  | 'projectId'
  | 'shortCode'
  | 'createdAt'
  | 'updatedAt'
  | 'seq'
  | 'completedAt'
  | 'commentCount'
  | 'statusChangedAt'
>;

const makeInitialDraft = (): Draft => ({
  content: '',
  description: '',
  links: [],
  requesterMemberId: props.currentMemberId,
  requestingDeptCode: null,
  assigneeMemberId: null,
  priorityCode: null,
  statusCode: props.statuses[0]?.code ?? '',
  deadline: null,
  plannedStartDate: null,
  plannedCompletionDate: null,
  plannedReleaseDate: null,
  tagCodes: [],
  flagCodes: [],
});

const draft = ref<Draft>(makeInitialDraft());
const submitting = ref(false);
const { errors, clearField, clear: clearErrors, setFromApiError } = useFormErrors();

// 「続けて作成」状態は localStorage で永続化（連続入力ユーザーの利便性）
const KEEP_OPEN_KEY = 'task-create-keep-open';
const keepOpen = ref(false);

onMounted(() => {
  if (import.meta.client) {
    keepOpen.value = localStorage.getItem(KEEP_OPEN_KEY) === '1';
  }
});

watch(keepOpen, (v) => {
  if (import.meta.client) {
    localStorage.setItem(KEEP_OPEN_KEY, v ? '1' : '0');
  }
});

const addLink = () => {
  draft.value.links.push({ label: '', url: '' });
};

const removeLink = (index: number) => {
  draft.value.links.splice(index, 1);
  clearErrors();
};

// URL 貼り付け時、その行のラベルが空かつ既知ドメインなら自動でラベルをセットする
const onLinkUrlPaste = (e: ClipboardEvent, link: TaskLink) => {
  if (link.label.trim()) return;
  const text = e.clipboardData?.getData('text') ?? '';
  const label = resolveLinkLabelFromUrl(text);
  if (label) link.label = label;
};

// ===== 下書きの保持 =====
// 外側クリック / Esc / X で誤って閉じても入力を失わないよう、下書きは閉じても保持する。
// さらに localStorage にも保存し（プロジェクトごと）、リロードや画面遷移もまたいで復元する。
// クリアされるのは「作成」成功時と明示的な「破棄」のみ。
const restoredDraft = ref(false);

const draftStorageKey = computed(() => `task-create-draft:${props.projectId}`);

const isDirtyDraft = (): boolean =>
  JSON.stringify(draft.value) !== JSON.stringify(makeInitialDraft());

/** 保存済み下書きを読む。壊れていれば null。欠けたフィールドは初期値で補う（将来の項目追加に耐える） */
const readStoredDraft = (): Draft | null => {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(draftStorageKey.value);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const merged: Draft = { ...makeInitialDraft(), ...(parsed as Partial<Draft>) };
    if (
      typeof merged.content !== 'string' ||
      typeof merged.description !== 'string' ||
      !Array.isArray(merged.links) ||
      !Array.isArray(merged.tagCodes) ||
      !Array.isArray(merged.flagCodes)
    ) {
      return null;
    }
    return merged;
  } catch {
    return null;
  }
};

// 入力のたびに保存。初期値と同じ（= 実質空）ならゴミを残さないよう消す
watch(
  draft,
  (d) => {
    if (!import.meta.client) return;
    try {
      if (isDirtyDraft()) {
        localStorage.setItem(draftStorageKey.value, JSON.stringify(d));
      } else {
        localStorage.removeItem(draftStorageKey.value);
      }
    } catch {
      // ignore（プライベートモード等）
    }
  },
  { deep: true },
);

onMounted(() => {
  const stored = readStoredDraft();
  if (stored) draft.value = stored;
});

/**
 * 復元した下書きから、削除済みマスタ（ステータス・タグ等）への参照を掃除する。
 * 永続化した下書きは日をまたいで生き残るため、開く時点の props と突き合わせる。
 */
const sanitizeDraft = () => {
  const d = draft.value;
  if (!props.statuses.some((s) => s.code === d.statusCode)) {
    d.statusCode = props.statuses[0]?.code ?? '';
  }
  if (d.priorityCode && !props.priorities.some((p) => p.code === d.priorityCode)) {
    d.priorityCode = null;
  }
  if (d.assigneeMemberId && !props.members.some((m) => m.id === d.assigneeMemberId)) {
    d.assigneeMemberId = null;
  }
  if (d.requesterMemberId && !props.members.some((m) => m.id === d.requesterMemberId)) {
    d.requesterMemberId = null;
  }
  if (d.requestingDeptCode && !props.departments.some((dep) => dep.code === d.requestingDeptCode)) {
    d.requestingDeptCode = null;
  }
  d.tagCodes = d.tagCodes.filter((c) => props.tags.some((t) => t.code === c));
  d.flagCodes = d.flagCodes.filter((c) => props.flags.some((f) => f.code === c));
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (isDirtyDraft()) {
        // 下書きが残っていればそのまま復元し、バナーで気付けるようにする。
        // 掃除の結果まっさらに戻った（削除済みタグしか無かった等）ならバナーは出さない
        sanitizeDraft();
        restoredDraft.value = isDirtyDraft();
      }
      if (!restoredDraft.value) {
        // まっさらなら最新の既定値（依頼者・先頭ステータス等）で初期化し直す
        draft.value = makeInitialDraft();
      }
      clearErrors();
    } else {
      restoredDraft.value = false;
    }
  },
);

// プロジェクトが変わったら、そのプロジェクトの保存済み下書き（無ければ初期値）に載せ替える
watch(
  () => props.projectId,
  () => {
    draft.value = readStoredDraft() ?? makeInitialDraft();
    clearErrors();
  },
);

const discardDraft = () => {
  draft.value = makeInitialDraft();
  clearErrors();
  restoredDraft.value = false;
};

const discardAndClose = () => {
  discardDraft();
  emit('update:open', false);
};

/** links.0.url のような path のエラーを取り出す */
const linkError = (index: number, field: 'label' | 'url'): string | undefined =>
  errors.value[`links.${index}.${field}`];

const canSubmit = computed(() => Boolean(draft.value.content.trim() && draft.value.statusCode));

const toast = useToast();

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  clearErrors();
  try {
    const task = await apiCreateTask(api, props.projectId, {
      content: draft.value.content.trim(),
      description: draft.value.description.trim(),
      links: draft.value.links,
      statusCode: draft.value.statusCode,
      priorityCode: draft.value.priorityCode,
      assigneeMemberId: draft.value.assigneeMemberId,
      requesterMemberId: draft.value.requesterMemberId,
      requestingDeptCode: draft.value.requestingDeptCode,
      deadline: draft.value.deadline,
      plannedStartDate: draft.value.plannedStartDate,
      plannedCompletionDate: draft.value.plannedCompletionDate,
      plannedReleaseDate: draft.value.plannedReleaseDate,
      tagCodes: draft.value.tagCodes,
      flagCodes: draft.value.flagCodes,
    });
    emit('created', task);
    // 作成できたら下書きはクリア（閉じる場合も残すと次回開いたとき作成済み内容が復元されてしまう）
    draft.value = makeInitialDraft();
    clearErrors();
    restoredDraft.value = false;
    // 続けて作成: slideover を開いたまま次の入力へ
    if (!keepOpen.value) {
      emit('update:open', false);
    }
  } catch (e: unknown) {
    setFromApiError(e);
    if (Object.keys(errors.value).length === 0) {
      const data =
        typeof e === 'object' && e !== null && 'data' in e
          ? ((e as { data?: { message?: string | string[] } }).data ?? {})
          : {};
      const msg = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? 'タスクの作成に失敗しました');
      toast.add({ title: msg, color: 'error' });
    }
  } finally {
    submitting.value = false;
  }
};

const statusMap = computed(() => Object.fromEntries(props.statuses.map((s) => [s.code, s])));
const priorityMap = computed(() => Object.fromEntries(props.priorities.map((p) => [p.code, p])));
const memberMap = computed(() => Object.fromEntries(props.members.map((m) => [m.id, m])));
const departmentMap = computed(() => Object.fromEntries(props.departments.map((d) => [d.code, d])));

const statusSelectItems = computed(() =>
  [...props.statuses]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ value: s.code, label: s.label })),
);

const prioritySelectItems = computed(() =>
  [...props.priorities]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ value: p.code, label: p.label })),
);

const memberSelectItems = computed(() =>
  props.members.map((m) => ({ value: m.id, label: m.displayName })),
);

/** 担当者用（readonly ユーザー紐づきメンバーは選べない）。依頼者は memberSelectItems を使う */
const assigneeSelectItems = computed(() =>
  assignableMembers(props.members).map((m) => ({ value: m.id, label: m.displayName })),
);

const departmentSelectItems = computed(() =>
  props.departments.map((d) => ({ value: d.code, label: d.name })),
);
</script>

<template>
  <USlideover
    :open="open"
    title="新規タスク"
    :ui="{ content: 'sm:max-w-(--task-slideover-width)' }"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <SlideoverResizeHandle />

      <div class="space-y-4 p-1">
        <!-- 黙って前回の内容が残っていると混乱するので、復元したことを明示する -->
        <UAlert
          v-if="restoredDraft"
          color="info"
          variant="subtle"
          icon="i-lucide-history"
          title="入力途中の下書きを復元しました"
          :actions="[
            {
              label: '破棄して新規入力',
              color: 'info',
              variant: 'outline',
              size: 'xs',
              onClick: discardDraft,
            },
          ]"
        />

        <UFormField label="内容" required :error="errors.content">
          <UInput
            v-model="draft.content"
            placeholder="タスクの概要"
            autofocus
            class="w-full"
            @update:model-value="clearField('content')"
          />
        </UFormField>

        <UFormField label="説明" :error="errors.description">
          <MarkdownEditor
            :model-value="draft.description"
            :tasks="tasks ?? []"
            :rows="4"
            show-images
            placeholder="詳細を記入（Markdown 可）"
            @update:model-value="
              (v: string) => {
                draft.description = v;
                clearField('description');
              }
            "
          />
        </UFormField>

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
            <p class="text-xs text-muted mb-1">担当者</p>
            <SelectMenu
              :items="assigneeSelectItems"
              :current="draft.assigneeMemberId"
              allow-none
              none-label="担当者なし"
              default-icon="i-lucide-user"
              searchable
              search-placeholder="名前で検索…"
              :self-value="currentMemberId"
              @select="(c: string | null) => (draft.assigneeMemberId = c)"
            >
              <button class="text-sm hover:underline cursor-pointer text-left">
                {{
                  draft.assigneeMemberId
                    ? (memberMap[draft.assigneeMemberId]?.displayName ?? '—')
                    : '担当者なし'
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
              searchable
              search-placeholder="名前で検索…"
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
            <p class="text-xs text-muted mb-1">着手予定日</p>
            <DatePopover
              :model-value="draft.plannedStartDate"
              @update:model-value="(v: string | null) => (draft.plannedStartDate = v)"
            >
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ draft.plannedStartDate ?? '—' }}
              </button>
            </DatePopover>
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
          <div>
            <p class="text-xs text-muted mb-1">リリース予定日</p>
            <DatePopover
              :model-value="draft.plannedReleaseDate"
              @update:model-value="(v: string | null) => (draft.plannedReleaseDate = v)"
            >
              <button class="text-sm tabular-nums hover:underline cursor-pointer text-left">
                {{ draft.plannedReleaseDate ?? '—' }}
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
          <p class="text-xs text-muted mb-1">フラグ</p>
          <TagPicker
            :tags="flags"
            :selected="draft.flagCodes"
            @update:selected="(codes: string[]) => (draft.flagCodes = codes)"
          >
            <button class="flex flex-wrap gap-1 cursor-pointer min-w-12">
              <UBadge
                v-for="code in draft.flagCodes"
                :key="code"
                :color="flags.find((f) => f.code === code)?.color ?? 'neutral'"
                variant="soft"
                :label="flags.find((f) => f.code === code)?.name ?? code"
              />
              <UBadge
                v-if="draft.flagCodes.length === 0"
                color="neutral"
                variant="outline"
                label="+ フラグ"
              />
            </button>
          </TagPicker>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">リンク</p>
          <div class="space-y-2">
            <div v-for="(link, i) in draft.links" :key="i" class="flex items-start gap-2">
              <!-- Tab 順を URL → ラベル → ボタン にするため、DOM 上は URL を先に置き、
                   ラベルは order-first で視覚的に先頭へ戻している。 -->
              <UFormField :error="linkError(i, 'url')" class="flex-1">
                <UInput
                  v-model="link.url"
                  autofocus
                  placeholder="https://..."
                  class="w-full"
                  @paste="(e: ClipboardEvent) => onLinkUrlPaste(e, link)"
                />
              </UFormField>
              <UFormField :error="linkError(i, 'label')" class="w-32 order-first">
                <UInput v-model="link.label" placeholder="ラベル" class="w-full" />
              </UFormField>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                class="mt-1"
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
      <div class="flex items-center justify-between gap-2 w-full">
        <UCheckbox v-model="keepOpen" label="続けて作成" />
        <div class="flex gap-2">
          <!-- 閉じる操作（外側クリック / Esc / X）は下書きを保持するのに対し、
               このボタンだけは破棄する。破壊的なことがラベルから分かるよう「破棄」とする -->
          <UButton color="neutral" variant="ghost" label="破棄" @click="discardAndClose" />
          <UButton
            color="primary"
            icon="i-lucide-plus"
            :loading="submitting"
            :disabled="!canSubmit"
            label="作成"
            @click="submit"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
