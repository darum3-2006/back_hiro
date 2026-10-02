import dayjs from 'dayjs';
import type { FetchError } from 'ofetch';

/**
 * 429 の解除までの秒数。サーバは制限ごとに `Retry-After`（分単位の default）/
 * `Retry-After-short`（秒単位）を返すので、そのうち最も長いものを採る。取れなければ null。
 */
export const retryAfterSecondsOf = (e: unknown): number | null => {
  const headers = (e as FetchError).response?.headers;
  if (!headers) return null;
  const secs = [...headers.entries()]
    .filter(([k]) => k.toLowerCase().startsWith('retry-after'))
    .map(([, v]) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return secs.length > 0 ? Math.max(...secs) : null;
};

/** 429 のときに画面へ出す文言。解除見込み時刻（と残り秒数）を添える */
export const rateLimitText = (
  retryAfter: number | null,
): { title: string; description: string } => ({
  title: 'アクセスが集中しています',
  description:
    retryAfter === null
      ? 'しばらく待ってから再度お試しください'
      : `${dayjs().add(retryAfter, 'second').format('HH:mm:ss')} 頃（約 ${retryAfter} 秒後）に解除される見込みです`,
});

/** 429 のトースト。同じ id で出すので、連続で 429 になっても 1 枚を上書きするだけになる */
export const rateLimitToast = (e: unknown) => ({
  id: 'rate-limited',
  ...rateLimitText(retryAfterSecondsOf(e)),
  color: 'warning' as const,
  icon: 'i-lucide-hourglass',
});
