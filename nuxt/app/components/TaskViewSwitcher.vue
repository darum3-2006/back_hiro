<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { SavedView, SavedViewVisibility } from '~/types/saved-view';

const props = defineProps<{
  views: SavedView[];
  selectedViewId: string | null;
  currentUserId: string | null;
  /** プロジェクト管理者か（孤児化した共有ビューの引き取り可否に使う） */
  canManageShared: boolean;
  /** 現在の表示状態が選択中ビューと異なるか */
  dirty: boolean;
}>();

const emit = defineEmits<{
  select: [string];
  clear: [];
  save: [];
  'save-as': [{ name: string; visibility: SavedViewVisibility }];
  rename: [{ id: string; name: string; visibility: SavedViewVisibility }];
  duplicate: [string];
  share: [SavedView];
  delete: [string];
}>();

const selectedView = computed(() => props.views.find((v) => v.id === props.selectedViewId) ?? null);

// readonly（閲覧のみ）ユーザーは自分の private ビューのみ操作可（共有化・引き取りは不可）
const { isReadonly } = useAuth();

/** 当該ビューを現在ユーザーが編集できるか（owner 本人 / 孤児 shared を admin が引き取り） */
const canEdit = (view: SavedView): boolean =>
  (view.ownerUserId === props.currentUserId &&
    (!isReadonly.value || view.visibility === 'private')) ||
  (view.ownerUserId === null &&
    view.visibility === 'shared' &&
    props.canManageShared &&
    !isReadonly.value);

const triggerLabel = computed(() => selectedView.value?.name ?? 'デフォルトビュー');

// ===== 保存/編集モーダル =====
const modalOpen = ref(false);
const modalMode = ref<'create' | 'rename'>('create');
const draftName = ref('');
const draftShared = ref(false);
const canSubmit = computed(() => Boolean(draftName.value.trim()));

const openCreate = () => {
  modalMode.value = 'create';
  draftName.value = '';
  draftShared.value = false;
  modalOpen.value = true;
};

const openRename = () => {
  const view = selectedView.value;
  if (!view) return;
  modalMode.value = 'rename';
  draftName.value = view.name;
  draftShared.value = view.visibility === 'shared';
  modalOpen.value = true;
};

// IME 変換中フラグ。変換確定/キャンセルの Enter・ESC を本来の確定/閉じる操作と
// 区別するために使う（keydown 時点では compositionend より前なので true のまま）。
const composing = ref(false);
const onCompositionStart = () => {
  composing.value = true;
};
const onCompositionEnd = () => {
  composing.value = false;
};

/** IME 変換確定の Enter で誤送信しないよう、変換中は無視する（ESC は AppModal が抑止） */
const onNameEnter = (e: KeyboardEvent) => {
  if (composing.value || e.isComposing) return;
  submitModal();
};

const submitModal = () => {
  if (!canSubmit.value) return;
  const name = draftName.value.trim();
  const visibility: SavedViewVisibility = draftShared.value ? 'shared' : 'private';
  if (modalMode.value === 'create') {
    emit('save-as', { name, visibility });
  } else if (selectedView.value) {
    emit('rename', { id: selectedView.value.id, name, visibility });
  }
  modalOpen.value = false;
};

// ===== 削除確認モーダル =====
const deleteModalOpen = ref(false);
const deleteTarget = ref<SavedView | null>(null);

const requestDelete = (view: SavedView) => {
  deleteTarget.value = view;
  deleteModalOpen.value = true;
};

const deleteDescription = computed(() => {
  const view = deleteTarget.value;
  if (!view) return '';
  return view.visibility === 'shared'
    ? `「${view.name}」を削除しますか? 共有ビューのため、プロジェクトの全メンバーから見えなくなります。`
    : `「${view.name}」を削除しますか?`;
});

const confirmDelete = () => {
  if (deleteTarget.value) emit('delete', deleteTarget.value.id);
  deleteModalOpen.value = false;
};

const toViewItem = (v: SavedView): DropdownMenuItem => ({
  label: v.name,
  icon: v.visibility === 'shared' ? 'i-lucide-users' : 'i-lucide-lock',
  type: 'checkbox',
  checked: v.id === props.selectedViewId,
  // 自分が作った共有ビューは「自分」バッジで識別できるようにする（private は元々自分のみ）
  slot:
    v.visibility === 'shared' && v.ownerUserId === props.currentUserId ? 'own-shared' : undefined,
  onSelect: (e: Event) => {
    e.preventDefault();
    emit('select', v.id);
  },
});

const items = computed<DropdownMenuItem[][]>(() => {
  // private / 共有でセクション分けする。各セクション内は名前の昇順（日本語考慮）で、
  // 共有ビューの並びは全メンバーで同じになる（所有者による並び替えはしない）
  const sortViews = (views: SavedView[]) =>
    [...views].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const privateViews = sortViews(props.views.filter((v) => v.visibility === 'private'));
  const sharedViews = sortViews(props.views.filter((v) => v.visibility === 'shared'));

  const viewGroups: DropdownMenuItem[][] = [];
  if (privateViews.length > 0 && sharedViews.length > 0) {
    viewGroups.push(
      [{ label: 'プライベートビュー', type: 'label' }, ...privateViews.map(toViewItem)],
      [{ label: '共有ビュー', type: 'label' }, ...sharedViews.map(toViewItem)],
    );
  } else {
    // 片方しかないときはラベルを出さずフラットに並べる（アイコンで区別できる）
    const all = [...privateViews, ...sharedViews];
    if (all.length > 0) viewGroups.push(all.map(toViewItem));
  }

  const actions: DropdownMenuItem[] = [];
  const view = selectedView.value;
  if (view && canEdit(view) && props.dirty) {
    actions.push({
      label: '現在の状態を上書き保存',
      icon: 'i-lucide-save',
      onSelect: () => emit('save'),
    });
  }
  actions.push({
    label: '新規ビューとして保存…',
    icon: 'i-lucide-plus',
    onSelect: () => openCreate(),
  });
  if (view && canEdit(view)) {
    actions.push({
      label: '名前 / 公開範囲を変更…',
      icon: 'i-lucide-pencil',
      onSelect: () => openRename(),
    });
  }
  if (view && !canEdit(view)) {
    actions.push({
      label: '複製して自分のビューにする',
      icon: 'i-lucide-copy',
      onSelect: () => emit('duplicate', view.id),
    });
  }
  // 共有リンクは全員が開ける shared ビューのみ
  if (view && view.visibility === 'shared') {
    actions.push({
      label: 'リンクを共有',
      icon: 'i-lucide-link',
      onSelect: () => emit('share', view),
    });
  }
  if (view) {
    actions.push({
      label: 'デフォルトに戻す',
      icon: 'i-lucide-rotate-ccw',
      onSelect: () => emit('clear'),
    });
  }
  if (view && canEdit(view)) {
    actions.push({
      label: 'このビューを削除',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => requestDelete(view),
    });
  }

  return [...viewGroups, actions];
});
</script>

<template>
  <div>
    <UDropdownMenu :items="items" :ui="{ content: 'min-w-56' }">
      <UButton color="neutral" variant="outline" trailing-icon="i-lucide-chevron-down">
        <UIcon name="i-lucide-bookmark" class="size-4" />
        <span class="truncate max-w-40">{{ triggerLabel }}</span>
        <span v-if="dirty" class="text-warning" aria-label="未保存の変更あり">●</span>
      </UButton>
      <template #own-shared-label="{ item }">
        <span class="truncate">{{ (item as DropdownMenuItem).label }}</span>
        <UBadge color="neutral" variant="subtle" size="sm" label="自分" />
      </template>
    </UDropdownMenu>

    <AppModal
      :open="modalOpen"
      :title="modalMode === 'create' ? '新規ビューとして保存' : 'ビューを編集'"
      @update:open="(v: boolean) => (modalOpen = v)"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="ビュー名" required>
            <UInput
              v-model="draftName"
              autofocus
              placeholder="例: 進行中タスク"
              class="w-full"
              @keydown.enter="onNameEnter"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd"
            />
          </UFormField>
          <UFormField
            v-if="!isReadonly"
            label="公開範囲"
            hint="共有にするとプロジェクトの全メンバーが使えます（編集は作成者のみ）"
          >
            <USwitch v-model="draftShared" label="プロジェクトで共有する" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="キャンセル" @click="modalOpen = false" />
          <UButton
            color="primary"
            :disabled="!canSubmit"
            :label="modalMode === 'create' ? '保存' : '更新'"
            @click="submitModal"
          />
        </div>
      </template>
    </AppModal>

    <AppModal v-model:open="deleteModalOpen" title="ビューを削除" :description="deleteDescription">
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="キャンセル"
            @click="deleteModalOpen = false"
          />
          <UButton color="error" icon="i-lucide-trash-2" label="削除" @click="confirmDelete" />
        </div>
      </template>
    </AppModal>
  </div>
</template>
