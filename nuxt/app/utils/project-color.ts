import type { MasterColor } from '~/types/master';

/**
 * プロジェクトのテーマ色 → 薄いトーンの背景クラス（MasterColor → 固定 Tailwind クラス）。
 * 動的クラス生成は purge されるため、リテラルで列挙する（gantt.ts と同じ流儀）。
 * セマンティック色（neutral〜error）は Tailwind パレットを持たないため、
 * Nuxt UI が生成する --ui-color-* 変数で塗る。
 */
export const projectTintClass = (color: MasterColor | null | undefined): string => {
  if (!color) return '';
  const map: Record<MasterColor, string> = {
    neutral: 'bg-(--ui-color-neutral-100) dark:bg-(--ui-color-neutral-800)',
    primary: 'bg-(--ui-color-primary-100) dark:bg-(--ui-color-primary-950)',
    secondary: 'bg-(--ui-color-secondary-100) dark:bg-(--ui-color-secondary-950)',
    info: 'bg-(--ui-color-info-100) dark:bg-(--ui-color-info-950)',
    success: 'bg-(--ui-color-success-100) dark:bg-(--ui-color-success-950)',
    warning: 'bg-(--ui-color-warning-100) dark:bg-(--ui-color-warning-950)',
    error: 'bg-(--ui-color-error-100) dark:bg-(--ui-color-error-950)',
    rose: 'bg-rose-100 dark:bg-rose-950',
    sky: 'bg-sky-100 dark:bg-sky-950',
    amber: 'bg-amber-100 dark:bg-amber-950',
    fuchsia: 'bg-fuchsia-100 dark:bg-fuchsia-950',
    emerald: 'bg-emerald-100 dark:bg-emerald-950',
    violet: 'bg-violet-100 dark:bg-violet-950',
    cyan: 'bg-cyan-100 dark:bg-cyan-950',
    indigo: 'bg-indigo-100 dark:bg-indigo-950',
    mauve: 'bg-mauve-100 dark:bg-mauve-950',
    olive: 'bg-olive-100 dark:bg-olive-950',
  };
  return map[color];
};
