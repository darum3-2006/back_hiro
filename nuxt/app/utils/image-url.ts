// 画像とみなす拡張子（クエリ/ハッシュは除いた path 末尾で判定）
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
const URL_RE = /https?:\/\/[^\s]+/g;
// URL 末尾に付きがちな句読点・閉じ括弧（LinkedText と同じ基準でリンク末尾を整える）
const TRAILING_RE = /[.,;:!?。、）)\]」』】>]+$/;

/** URL の path 末尾が画像拡張子なら true（クエリ・ハッシュは無視） */
export const isImageUrl = (url: string): boolean => {
  const path = url.split(/[?#]/)[0] ?? '';
  return IMAGE_EXT_RE.test(path);
};

/** テキスト中に画像 URL が 1 つでも含まれるか（末尾句読点を除いて判定） */
export const hasImageUrl = (text: string): boolean => {
  if (!text) return false;
  const matches = text.match(URL_RE);
  if (!matches) return false;
  return matches.some((raw) => {
    const trail = TRAILING_RE.exec(raw);
    const url = trail ? raw.slice(0, raw.length - trail[0].length) : raw;
    return isImageUrl(url);
  });
};
