import type { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../auth/jwt.strategy';

interface TrackableRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}

/** JwtStrategy と同じ順（Authorization: Bearer → SSE 用の ?token=）でアクセストークンを取り出す */
const extractToken = (req: TrackableRequest): string | null => {
  const auth = req.headers?.authorization;
  const header = Array.isArray(auth) ? auth[0] : auth;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim() || null;
  const q = req.query?.token;
  return typeof q === 'string' && q ? q : null;
};

/**
 * レート制限のカウント単位（tracker）を決める関数を作る。
 * - 有効なアクセストークン付き → `user:<userId>`（同じ IP の利用者同士で上限を分け合わない）
 * - それ以外（未ログイン・API キー・無効/期限切れトークン）→ `ip:<IP>`
 *
 * ThrottlerGuard はグローバルガードとして JwtAuthGuard より先に走り req.user がまだ無いので、
 * ここで署名を検証する。検証せずに sub を使うと、偽トークンで tracker を毎回変えて制限を
 * すり抜けられてしまう。公開 API の API キー（同じく Bearer）も同じ理由で（照合に DB が要るため）
 * キー文字列は使わず、JWT として検証に失敗するので IP で数える。
 */
export const buildThrottleTracker =
  (jwt: JwtService) =>
  (req: TrackableRequest): string => {
    const token = extractToken(req);
    if (token) {
      try {
        const payload = jwt.verify<JwtPayload>(token);
        if (payload.sub) return `user:${payload.sub}`;
      } catch {
        // 無効・期限切れは IP で数える
      }
    }
    return `ip:${req.ip ?? 'unknown'}`;
  };
