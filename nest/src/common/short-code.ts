import { randomBytes } from 'crypto';

// 短縮コードに使う文字種（英大小 + 数字 = 62 種）
const SHORT_CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHORT_CODE_LENGTH = 10;

/** 不透明な短縮コードを 1 つ生成する（base62 / 10 桁、共有リンク用）。 */
export const generateShortCode = (): string => {
  const bytes = randomBytes(SHORT_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    out += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length];
  }
  return out;
};
