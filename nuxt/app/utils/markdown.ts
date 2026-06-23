import MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import { isImageUrl } from './image-url';

/** render 時に env として渡すコンテキスト */
interface MarkdownEnv {
  /** #seq 内部リンク解決用（seq の存在判定） */
  taskSeqs?: Set<number>;
  /** @メンション強調の候補名（長い名前を優先） */
  mentionNames?: string[];
  /** 裸の画像 URL をサムネイル表示するか */
  showImages?: boolean;
}

// html:false で生 HTML を無効化（XSS 安全）＋ URL スキームも markdown-it が検証する。
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

// 外部リンクは新規タブ＋ rel を付ける
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

// ===== 裸の画像 URL → サムネイル =====
// インラインルールは 'h' のような非ターミネータ文字位置では発火しないため、
// linkify が作ったリンクトークンを後段（core）で画像トークンへ置き換える。
md.core.ruler.after('linkify', 'image_urls', (state) => {
  const env = state.env as MarkdownEnv;
  if (!env.showImages) return;
  for (const blockToken of state.tokens) {
    if (blockToken.type !== 'inline' || !blockToken.children) continue;
    const children = blockToken.children;
    for (let i = 0; i < children.length; i++) {
      const open = children[i];
      if (!open || open.type !== 'link_open' || open.markup !== 'linkify') continue;
      const href = open.attrGet('href');
      if (!href || !isImageUrl(href)) continue;
      let j = i + 1;
      while (j < children.length && children[j]?.type !== 'link_close') j++;
      if (j >= children.length) continue;
      const img = new state.Token('imageurl', '', 0);
      img.content = href;
      children.splice(i, j - i + 1, img);
    }
  }
});
md.renderer.rules.imageurl = (tokens, idx) => {
  const url = md.utils.escapeHtml(tokens[idx]?.content ?? '');
  return `<img class="md-img" src="${url}" alt="${url}" loading="lazy" />`;
};

// ===== #15 内部タスクリンク =====
md.inline.ruler.before('link', 'taskref', (state: StateInline, silent: boolean): boolean => {
  if (state.src[state.pos] !== '#') return false;
  const prev = state.pos > 0 ? (state.src[state.pos - 1] ?? ' ') : ' ';
  if (/[0-9A-Za-z]/.test(prev)) return false;
  const m = /^#(\d+)/.exec(state.src.slice(state.pos));
  if (!m) return false;
  if (!silent) {
    const env = state.env as MarkdownEnv;
    const seq = Number(m[1]);
    const token = state.push('taskref', '', 0);
    token.content = m[0];
    token.meta = { seq, exists: env.taskSeqs?.has(seq) ?? false };
  }
  state.pos += m[0].length;
  return true;
});
md.renderer.rules.taskref = (tokens, idx) => {
  const token = tokens[idx];
  const text = md.utils.escapeHtml(token?.content ?? '');
  const meta = token?.meta as { seq: number; exists: boolean } | undefined;
  if (!meta?.exists) return text;
  return `<a class="md-taskref" data-task-seq="${meta.seq}">${text}</a>`;
};

// ===== @メンション強調 =====
md.inline.ruler.before('link', 'mention', (state: StateInline, silent: boolean): boolean => {
  if (state.src[state.pos] !== '@') return false;
  const env = state.env as MarkdownEnv;
  const names = env.mentionNames;
  if (!names || names.length === 0) return false;
  const prev = state.pos > 0 ? (state.src[state.pos - 1] ?? ' ') : ' ';
  if (/[0-9A-Za-z]/.test(prev)) return false;
  const rest = state.src.slice(state.pos + 1);
  const name = names.filter((n) => n && rest.startsWith(n)).sort((a, b) => b.length - a.length)[0];
  if (!name) return false;
  if (!silent) {
    const token = state.push('mention', '', 0);
    token.content = `@${name}`;
  }
  state.pos += 1 + name.length;
  return true;
});
md.renderer.rules.mention = (tokens, idx) =>
  `<span class="md-mention">${md.utils.escapeHtml(tokens[idx]?.content ?? '')}</span>`;

interface RenderOptions {
  tasks?: { seq: number }[];
  mentionNames?: string[];
  showImages?: boolean;
}

/**
 * Markdown は連続する空行を 1 段落区切りに畳むが、入力どおりの縦の空きを保ちたいので
 * 3 連続以上の改行（＝2 行以上の空行）を空段落で再現する。コードブロック内は対象外。
 */
const preserveBlankLines = (text: string): string =>
  text.replace(/\n{3,}/g, (run) => `\n\n${'&nbsp;\n\n'.repeat(run.length - 2)}`);

/** Markdown を安全な HTML へ変換する（#seq / @mention / 画像URL / 空行保持を考慮）。 */
export const renderMarkdown = (text: string, opts: RenderOptions = {}): string => {
  if (!text) return '';
  const env: MarkdownEnv = {
    taskSeqs: new Set((opts.tasks ?? []).map((t) => t.seq)),
    mentionNames: opts.mentionNames ?? [],
    showImages: opts.showImages ?? false,
  };
  // ``` で囲まれたコードブロックは空行を保持したいので前処理対象から外す
  const normalized = text.replace(/\r\n?/g, '\n');
  const processed = normalized
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => (i % 2 === 1 ? part : preserveBlankLines(part)))
    .join('');
  return md.render(processed, env);
};
