<script setup lang="ts">
import type { Task } from '~/types/task';
import { renderMarkdown } from '~/utils/markdown';

const props = withDefaults(
  defineProps<{
    text: string;
    /** #seq 内部リンク解決用 */
    tasks?: Task[];
    /** @メンション強調の候補名 */
    mentionNames?: string[];
    /** 裸の画像 URL をサムネイル表示するか */
    showImages?: boolean;
  }>(),
  { tasks: () => [], mentionNames: () => [], showImages: false },
);

const html = computed(() =>
  renderMarkdown(props.text, {
    tasks: props.tasks,
    mentionNames: props.mentionNames,
    showImages: props.showImages,
  }),
);

const route = useRoute();
const router = useRouter();

// #seq リンクはクリック委譲で ?task= へ遷移（v-html 内なので NuxtLink は使えない）
const onClick = (e: MouseEvent) => {
  const target = (e.target as HTMLElement | null)?.closest('[data-task-seq]');
  if (!target) return;
  e.preventDefault();
  const seq = target.getAttribute('data-task-seq');
  if (seq) void router.replace({ query: { ...route.query, task: seq } });
};
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- markdown-it(html:false) で生成した安全な HTML -->
  <div class="md-content text-sm" @click="onClick" v-html="html" />
</template>

<style scoped>
.md-content :deep(p) {
  margin: 0.25rem 0;
}
.md-content :deep(p:first-child) {
  margin-top: 0;
}
.md-content :deep(p:last-child) {
  margin-bottom: 0;
}
.md-content :deep(h1),
.md-content :deep(h2),
.md-content :deep(h3),
.md-content :deep(h4) {
  font-weight: 600;
  margin: 0.75rem 0 0.35rem;
  line-height: 1.3;
}
.md-content :deep(h1) {
  font-size: 1.25rem;
}
.md-content :deep(h2) {
  font-size: 1.125rem;
}
.md-content :deep(h3) {
  font-size: 1rem;
}
.md-content :deep(ul),
.md-content :deep(ol) {
  margin: 0.25rem 0;
  padding-left: 1.4rem;
}
.md-content :deep(ul) {
  list-style: disc;
}
.md-content :deep(ol) {
  list-style: decimal;
}
.md-content :deep(li) {
  margin: 0.1rem 0;
}
.md-content :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
}
.md-content :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  background: var(--ui-bg-elevated);
  padding: 0.1em 0.3em;
  border-radius: 0.25rem;
}
.md-content :deep(pre) {
  background: var(--ui-bg-elevated);
  padding: 0.6rem 0.8rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  margin: 0.4rem 0;
}
.md-content :deep(pre code) {
  background: transparent;
  padding: 0;
}
.md-content :deep(blockquote) {
  border-left: 3px solid var(--ui-border);
  padding-left: 0.75rem;
  color: var(--ui-text-muted);
  margin: 0.4rem 0;
}
.md-content :deep(table) {
  border-collapse: collapse;
  margin: 0.4rem 0;
}
.md-content :deep(th),
.md-content :deep(td) {
  border: 1px solid var(--ui-border);
  padding: 0.25rem 0.5rem;
}
.md-content :deep(hr) {
  border: 0;
  border-top: 1px solid var(--ui-border);
  margin: 0.75rem 0;
}
.md-content :deep(.md-img) {
  max-height: 8rem;
  max-width: 100%;
  border-radius: 0.375rem;
  border: 1px solid var(--ui-border);
  margin: 0.25rem 0;
}
.md-content :deep(.md-taskref) {
  color: var(--ui-primary);
  cursor: pointer;
  text-decoration: none;
}
.md-content :deep(.md-taskref:hover) {
  text-decoration: underline;
}
.md-content :deep(.md-mention) {
  color: var(--ui-primary);
  font-weight: 500;
  background: color-mix(in oklab, var(--ui-primary) 10%, transparent);
  border-radius: 0.25rem;
  padding: 0 0.15rem;
}
</style>
