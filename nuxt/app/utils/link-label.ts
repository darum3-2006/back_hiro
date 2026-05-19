/**
 * URL のドメインからラベル候補を解決するユーティリティ。
 *
 * リンク追加時に URL を貼り付けると、特定ドメイン（github.com / trello.com 等）
 * のときだけ自動でラベル欄をセットするための辞書と関数。
 * 拡張は DOMAIN_LABEL_MAP に 1 行追加するだけ。
 */
const DOMAIN_LABEL_MAP: Record<string, string> = {
  'github.com': 'Github',
  'trello.com': 'Trello',
};

/**
 * URL（スキーム無しでも可）からラベル候補を返す。マッチしなければ null。
 *
 * - スキームが無い場合は `https://` を前置してから URL パース
 * - hostname の先頭 `www.` は無視
 * - 完全一致 or サブドメイン一致（例: gist.github.com → Github）
 */
export const resolveLinkLabelFromUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let hostname: string;
  try {
    hostname = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!hostname) return null;
  if (hostname.startsWith('www.')) hostname = hostname.slice(4);

  for (const [domain, label] of Object.entries(DOMAIN_LABEL_MAP)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return label;
  }
  return null;
};
