<script setup lang="ts">
interface MentionCandidate {
  /** 通知先 User.id（このコンポーネントでは表示のみに使用） */
  id: string;
  /** 表示・挿入する名前（User.name） */
  name: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    candidates: MentionCandidate[];
    rows?: number;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { rows: 3, placeholder: '', disabled: false },
);

const emit = defineEmits<{
  'update:modelValue': [string];
  /** Cmd/Ctrl+Enter（候補ドロップダウンが閉じているとき） */
  submit: [];
}>();

const taRef = ref<HTMLTextAreaElement | null>(null);
const query = ref('');
const mentionStart = ref(-1); // '@' の位置。-1 = メンション入力中でない
const activeIndex = ref(0);

const filtered = computed(() => {
  if (mentionStart.value < 0) return [];
  const q = query.value.toLowerCase();
  return props.candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
});
const open = computed(() => mentionStart.value >= 0 && filtered.value.length > 0);

// 下に余裕が無ければ上に出す
const placement = ref<'top' | 'bottom'>('bottom');
const updatePlacement = () => {
  if (!import.meta.client) return;
  const el = taRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const needed = Math.min(filtered.value.length * 34 + 8, 224); // 行高 + 余白、max-h-56 上限
  placement.value = spaceBelow < needed && rect.top > spaceBelow ? 'top' : 'bottom';
};
watch(
  [open, () => filtered.value.length],
  () => {
    if (open.value) updatePlacement();
  },
  { flush: 'post' },
);

/** カーソル直前の `@token` を検出してドロップダウン状態を更新する */
const detect = () => {
  const el = taRef.value;
  if (!el) return;
  const caret = el.selectionStart ?? props.modelValue.length;
  const before = props.modelValue.slice(0, caret);
  const m = /(?:^|\s)@([^\s@]*)$/.exec(before);
  if (m) {
    const nextQuery = m[1] ?? '';
    // クエリが変わったときだけ選択位置を先頭へ戻す（上下キー操作では維持する）
    if (nextQuery !== query.value || mentionStart.value < 0) activeIndex.value = 0;
    query.value = nextQuery;
    mentionStart.value = caret - nextQuery.length - 1;
  } else {
    mentionStart.value = -1;
  }
};

const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
  detect();
};

const select = (c: MentionCandidate) => {
  const el = taRef.value;
  if (!el) return;
  const caret = el.selectionStart ?? props.modelValue.length;
  const before = props.modelValue.slice(0, mentionStart.value);
  const after = props.modelValue.slice(caret);
  const insert = `@${c.name} `;
  emit('update:modelValue', before + insert + after);
  mentionStart.value = -1;
  void nextTick(() => {
    const pos = (before + insert).length;
    el.focus();
    el.setSelectionRange(pos, pos);
  });
};

const onKeydown = (e: KeyboardEvent) => {
  if (open.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex.value = (activeIndex.value + 1) % filtered.value.length;
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex.value = (activeIndex.value - 1 + filtered.value.length) % filtered.value.length;
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      const c = filtered.value[activeIndex.value];
      if (c) {
        e.preventDefault();
        select(c);
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      mentionStart.value = -1;
      return;
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    emit('submit');
  }
};

const onBlur = () => {
  // 候補クリック（mousedown）を拾えるよう少し遅延して閉じる
  setTimeout(() => {
    mentionStart.value = -1;
  }, 150);
};
</script>

<template>
  <div class="relative">
    <textarea
      ref="taRef"
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      :placeholder="placeholder"
      class="w-full resize-y rounded-md border border-default bg-default px-2.5 py-1.5 text-sm text-highlighted placeholder:text-dimmed focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75"
      @input="onInput"
      @keydown="onKeydown"
      @keyup="detect"
      @click="detect"
      @blur="onBlur"
    />
    <ul
      v-if="open"
      class="absolute left-0 right-0 z-20 max-h-56 overflow-y-auto rounded-md border border-default bg-default py-1 shadow-lg"
      :class="placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'"
    >
      <li
        v-for="(c, i) in filtered"
        :key="c.id"
        class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm"
        :class="i === activeIndex ? 'bg-elevated' : 'hover:bg-elevated/50'"
        @mousedown.prevent="select(c)"
      >
        <UIcon name="i-lucide-at-sign" class="size-3.5 text-muted shrink-0" />
        <span class="truncate">{{ c.name }}</span>
      </li>
    </ul>
  </div>
</template>
