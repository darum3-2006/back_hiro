<script setup lang="ts">
import type { Task } from '~/types/task';
import { isImageUrl } from '~/utils/image-url';

const props = withDefaults(
  defineProps<{
    /** 表示するテキスト（description / コメント本文など） */
    text: string;
    /** seq → id 解決のためのタスク一覧 */
    tasks: Task[];
    /** 画像 URL を縮小画像（サムネイル）で表示するか */
    showImages?: boolean;
    /** @メンションとして強調する候補名（User.name）。`@名前` 部分をハイライトする */
    mentionNames?: string[];
  }>(),
  { showImages: false, mentionNames: () => [] },
);

interface Segment {
  type: 'text' | 'task' | 'url' | 'mention';
  text: string;
  /** type='task' のとき: 内部リンク先の連番 */
  seq?: number;
  /** type='url' のとき: 外部リンクの href */
  href?: string;
  /** type='url' かつ画像 URL のとき true */
  isImage?: boolean;
}

// 読み込みに失敗した画像 URL。サムネイル → テキストリンクへフォールバックする。
const failedImages = ref<Set<string>>(new Set());
const onImageError = (href: string) => {
  const next = new Set(failedImages.value);
  next.add(href);
  failedImages.value = next;
};

// URL 末尾に付きがちな句読点・閉じ括弧はリンクから除外してテキストへ戻す。
const TRAILING_RE = /[.,;:!?。、）)\]」』】>]+$/;

/** `#15`（内部リンク）と URL（外部リンク）を検出してセグメントへ分解 */
const baseSegments = computed<Segment[]>(() => {
  if (!props.text) return [];
  // http(s):// の URL、または `#15` のような番号を検出する。
  // URL を先に並べることで、URL 内の `#...` を番号として誤検出しない。
  // 共有状態（lastIndex）を避けるため computed 内でローカルに生成する。
  const re = /(https?:\/\/[^\s]+)|#(\d+)/g;
  const out: Segment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(props.text)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: 'text', text: props.text.slice(lastIndex, m.index) });
    }
    if (m[1] !== undefined) {
      // URL: 末尾の句読点・閉じ括弧はリンクから外す
      const raw = m[1];
      const trail = TRAILING_RE.exec(raw);
      const url = trail ? raw.slice(0, raw.length - trail[0].length) : raw;
      out.push({ type: 'url', text: url, href: url, isImage: isImageUrl(url) });
      if (trail) out.push({ type: 'text', text: trail[0] });
    } else {
      // `#番号`: tasks に該当 seq があれば内部リンク、無ければただのテキスト
      const seq = Number(m[2]);
      const target = props.tasks.find((t) => t.seq === seq);
      if (target) {
        out.push({ type: 'task', text: m[0], seq: target.seq });
      } else {
        out.push({ type: 'text', text: m[0] });
      }
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < props.text.length) {
    out.push({ type: 'text', text: props.text.slice(lastIndex) });
  }
  return out;
});

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** text セグメント内の `@候補名` をメンションセグメントへ分割する（長い名前を優先） */
const splitMentions = (text: string): Segment[] => {
  const names = [...props.mentionNames].filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0 || !text.includes('@')) return [{ type: 'text', text }];
  const re = new RegExp(`@(?:${names.map(escapeRe).join('|')})`, 'g');
  const out: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    out.push({ type: 'mention', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
};

// URL / #seq 分解の後、プレーンテキスト部分の @メンションを強調する
const segments = computed<Segment[]>(() =>
  baseSegments.value.flatMap((s) => (s.type === 'text' ? splitMentions(s.text) : [s])),
);

const route = useRoute();

// URL クエリにはタスクの連番(seq)を載せる
const linkTo = (seq: number) => ({
  query: { ...route.query, task: String(seq) },
});
</script>

<template>
  <span class="whitespace-pre-wrap">
    <template v-for="(s, i) in segments" :key="i">
      <NuxtLink
        v-if="s.type === 'task' && s.seq !== undefined"
        :to="linkTo(s.seq)"
        replace
        class="text-primary hover:underline"
        >{{ s.text }}</NuxtLink
      >
      <a
        v-else-if="s.type === 'url' && s.href"
        :href="s.href"
        target="_blank"
        rel="noopener noreferrer"
        :class="
          showImages && s.isImage && !failedImages.has(s.href)
            ? 'inline-block align-top'
            : 'text-primary hover:underline break-all'
        "
        @click.stop
      >
        <img
          v-if="showImages && s.isImage && !failedImages.has(s.href)"
          :src="s.href"
          :alt="s.text"
          loading="lazy"
          class="my-1 max-h-32 max-w-full rounded border border-default object-contain"
          @error="onImageError(s.href)"
        />
        <template v-else>{{ s.text }}</template>
      </a>
      <span
        v-else-if="s.type === 'mention'"
        class="rounded bg-primary/10 px-0.5 font-medium text-primary"
        >{{ s.text }}</span
      >
      <template v-else>{{ s.text }}</template>
    </template>
  </span>
</template>
