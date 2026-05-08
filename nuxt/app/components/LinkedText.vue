<script setup lang="ts">
import type { Task } from '~/types/task';

const props = defineProps<{
  /** 表示するテキスト（description / コメント本文など） */
  text: string;
  /** seq → id 解決のためのタスク一覧 */
  tasks: Task[];
}>();

interface Segment {
  type: 'text' | 'link';
  text: string;
  taskId?: string;
}

/** `#15` のような番号を検出して、tasks に該当 seq があれば内部リンクに分解 */
const segments = computed<Segment[]>(() => {
  if (!props.text) return [];
  const re = /#(\d+)/g;
  const out: Segment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(props.text)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: 'text', text: props.text.slice(lastIndex, m.index) });
    }
    const seq = Number(m[1]);
    const target = props.tasks.find((t) => t.seq === seq);
    if (target) {
      out.push({ type: 'link', text: m[0], taskId: target.id });
    } else {
      out.push({ type: 'text', text: m[0] });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < props.text.length) {
    out.push({ type: 'text', text: props.text.slice(lastIndex) });
  }
  return out;
});

const route = useRoute();

const linkTo = (taskId: string) => ({
  query: { ...route.query, task: taskId },
});
</script>

<template>
  <span class="whitespace-pre-wrap">
    <template v-for="(s, i) in segments" :key="i">
      <NuxtLink
        v-if="s.type === 'link' && s.taskId"
        :to="linkTo(s.taskId)"
        replace
        class="text-primary hover:underline"
      >{{ s.text }}</NuxtLink>
      <template v-else>{{ s.text }}</template>
    </template>
  </span>
</template>
