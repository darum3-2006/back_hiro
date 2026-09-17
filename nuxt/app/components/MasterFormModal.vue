<script setup lang="ts">
import type { MasterColor } from '~/types/master';

export interface MasterFormPayload {
  name: string;
  color: MasterColor;
  isTerminal: boolean;
  /** 初期状態（未着手扱い）。ステータス以外では使わないので任意 */
  isInitial?: boolean;
}

const props = defineProps<{
  open: boolean;
  type: 'status' | 'priority' | 'tag' | 'flag';
  initial: MasterFormPayload | null;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  submit: [MasterFormPayload];
}>();

const EMPTY: MasterFormPayload = {
  name: '',
  color: 'neutral',
  isTerminal: false,
  isInitial: false,
};

const draft = ref<MasterFormPayload>({ ...EMPTY });

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    draft.value = props.initial ? { ...props.initial } : { ...EMPTY };
  },
);

const titleNoun = computed(
  () => ({ status: 'ステータス', priority: '優先度', tag: 'タグ', flag: 'フラグ' })[props.type],
);
const labelText = computed(
  () => ({ status: 'ラベル', priority: 'ラベル', tag: '名前', flag: '名前' })[props.type],
);
const showStatusFlags = computed(() => props.type === 'status');

// 初期と終了は排他（サーバ側でも弾くが、そもそも不正な状態を作れないようにする）
const setInitial = (v: boolean) => {
  draft.value.isInitial = v;
  if (v) draft.value.isTerminal = false;
};

const setTerminal = (v: boolean) => {
  draft.value.isTerminal = v;
  if (v) draft.value.isInitial = false;
};
const isEdit = computed(() => Boolean(props.initial));
const canSubmit = computed(() => Boolean(draft.value.name.trim()));

const submit = () => {
  if (!canSubmit.value) return;
  emit('submit', {
    name: draft.value.name.trim(),
    color: draft.value.color,
    isTerminal: draft.value.isTerminal,
    isInitial: draft.value.isInitial,
  });
  emit('update:open', false);
};
</script>

<template>
  <AppModal
    :open="open"
    :title="isEdit ? `${titleNoun}を編集` : `新規${titleNoun}`"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField :label="labelText" required>
          <UInput v-model="draft.name" autofocus class="w-full" />
        </UFormField>
        <UFormField label="色">
          <ColorPicker v-model="draft.color" />
        </UFormField>
        <!-- UFormField は配下のコントロールに同じ id を配るため、チェックボックスを
             複数入れると label の for が全部先頭の input を指してしまう。
             独立させて素の見出しを置く。 -->
        <div v-if="showStatusFlags" class="space-y-2">
          <p class="text-sm font-medium">タスクの進行状態</p>
          <UCheckbox
            :model-value="draft.isInitial ?? false"
            label="未着手として扱う"
            help="このステータスのままのタスクは「停滞」に数えません"
            @update:model-value="(v: boolean | 'indeterminate') => setInitial(v === true)"
          />
          <UCheckbox
            :model-value="draft.isTerminal"
            label="完了として扱う"
            help="対応終了を表すステータス。一覧から既定で隠れます"
            @update:model-value="(v: boolean | 'indeterminate') => setTerminal(v === true)"
          />
          <p class="text-xs text-muted">どちらか一方のみ設定できます。</p>
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
          :disabled="!canSubmit"
          :label="isEdit ? '保存' : '追加'"
          @click="submit"
        />
      </div>
    </template>
  </AppModal>
</template>
