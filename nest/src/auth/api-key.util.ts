import { createHash, randomBytes } from 'crypto';
import type { UserRole } from '../users/user.entity';

/** 公開APIキーを発行・利用できるロール（admin / power_user）。 */
export const canUseApiKey = (role: UserRole): boolean => role === 'admin' || role === 'power_user';

/** 公開APIキーの接頭辞（環境識別用）。 */
const API_KEY_PREFIX = 'bh_live_';
/** ランダム部のバイト数（base64url で約 43 文字）。 */
const API_KEY_BYTES = 32;
/** 表示用に保持する先頭文字数。 */
const DISPLAY_PREFIX_LENGTH = 12;

export interface GeneratedApiKey {
  /** 平文キー。発行時に一度だけ呼び出し側へ返す（保存しない）。 */
  plaintext: string;
  /** DB に保存する sha256 ハッシュ（hex）。 */
  hash: string;
  /** 表示用の先頭プレフィックス（例: bh_live_AbCd）。 */
  prefix: string;
}

/** キー平文を sha256(hex) でハッシュ化する。認証時の照合にも使う。 */
export const hashApiKey = (plaintext: string): string =>
  createHash('sha256').update(plaintext).digest('hex');

/** 新しい公開APIキーを生成する。 */
export const generateApiKey = (): GeneratedApiKey => {
  const random = randomBytes(API_KEY_BYTES).toString('base64url');
  const plaintext = `${API_KEY_PREFIX}${random}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, DISPLAY_PREFIX_LENGTH),
  };
};
