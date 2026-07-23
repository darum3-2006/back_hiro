<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { SavedView, SavedViewVisibility } from '~/types/saved-view';

const props = defineProps<{
  views: SavedView[];
  selectedViewId: string | null;
  currentUserId: string | null;
  /** 管理者か（テナント admin / プロジェクト admin。共有ビューの削除・公開範囲変更に使う） */
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

// readonly（閲覧のみ）ユーザーは自分の private ビューのみ操作可（共有ビューは一切操作不可）
const { isReadonly } = useAuth();

/** ビューが自分のものか（孤児 owner=null は除外） */
const isOwner = (view: SavedView): boolean =>
  view.ownerUserId !== null && view.ownerUserId === props.currentUserId;

/** 名前・設定（上書き保存）を編集できるか: 自分のビュー、共有ビューは全メンバー */
const canEditContent = (view: SavedView): boolean =>
  isReadonly.value
    ? isOwner(view) && view.visibility === 'private'
    : isOwner(view) || view.visibility === 'shared';

/** 削除・公開範囲の変更ができるか: 作成者本人、共有ビューは admin も可 */
const canDeleteOrChangeVisibility = (view: SavedView): boolean =>
  isReadonly.value
    ? isOwner(view) && view.visibility === 'private'
    : isOwner(view) || (view.visibility === 'shared' && props.canManageShared);

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

/**
 * モーダルに公開範囲スイッチを出すか。
 * 新規作成は readonly 以外なら常に可。既存の変更は削除と同じ権限（作成者 / admin）に限定
 */
const showVisibilityField = computed(() => {
  if (isReadonly.value) return false;
  if (modalMode.value === 'create') return true;
  return selectedView.value ? canDeleteOrChangeVisibility(selectedView.value) : false;
});

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

const items = computed<DropdownMenuItem[][]>(() => {
  // プルダウンは名前の昇順（日本語考慮）で並べる
  const sortedViews = [...props.views].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const viewItems: DropdownMenuItem[] = sortedViews.map((v) => ({
    label: v.name,
    icon: v.visibility === 'shared' ? 'i-lucide-users' : 'i-lucide-lock',
    type: 'checkbox',
    checked: v.id === props.selectedViewId,
    onSelect: (e: Event) => {
      e.preventDefault();
      emit('select', v.id);
    },
  }));

  const actions: DropdownMenuItem[] = [];
  const view = selectedView.value;
  if (view && canEditContent(view) && props.dirty) {
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
  if (view && canEditContent(view)) {
    actions.push({
      label: canDeleteOrChangeVisibility(view) ? '名前 / 公開範囲を変更…' : '名前を変更…',
      icon: 'i-lucide-pencil',
      onSelect: () => openRename(),
    });
  }
  if (view && !isOwner(view)) {
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
  if (view && canDeleteOrChangeVisibility(view)) {
    actions.push({
      label: 'このビューを削除',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => requestDelete(view),
    });
  }

  return viewItems.length > 0 ? [viewItems, actions] : [actions];
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
            v-if="showVisibilityField"
            label="公開範囲"
            hint="共有にすると全メンバーが使え、名前や条件を編集できます（削除・公開範囲の変更は作成者と管理者のみ）"
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
