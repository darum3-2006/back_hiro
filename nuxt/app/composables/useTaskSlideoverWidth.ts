/** 既定幅（px）。Nuxt UI の `sm:max-w-xl` = 36rem 相当 */
const DEFAULT_WIDTH = 576;

/** これ以下だと項目ラベルと値が破綻するため下限とする */
export const TASK_SLIDEOVER_MIN_WIDTH = 400;

/** 右端いっぱいに広げず、オーバーレイ（クリックで閉じる領域）を必ず残す */
const VIEWPORT_MARGIN = 64;

/** キーボード操作 1 回あたりの増減幅（px） */
const NUDGE_STEP = 32;

// タスク詳細だけの設定だった頃のキーをそのまま使う（既に保存済みの幅を捨てないため）
const STORAGE_KEY = 'taskDetail:width';

/** 実際の幅は main.css の `:root` で既定値を持つこの CSS 変数で決まる */
const CSS_VAR = '--task-slideover-width';

const clampWidth = (px: number): number => {
  const max = Math.max(TASK_SLIDEOVER_MIN_WIDTH, window.innerWidth - VIEWPORT_MARGIN);
  return Math.min(Math.max(Math.round(px), TASK_SLIDEOVER_MIN_WIDTH), max);
};

/**
 * タスクのスライドオーバー（詳細 / 新規登録）の表示幅を D&D で変更し、localStorage に記憶する。
 * 幅は 2 画面で共通の 1 つの値。
 *
 * 幅は Vue の再描画を挟まず `document.documentElement` の CSS 変数へ直接書き込む。
 * スライドオーバーは body へテレポートされるため、html に載せた変数が確実に届く。
 */
export const useTaskSlideoverWidth = () => {
  const width = useState<number>('taskSlideoverWidth', () => DEFAULT_WIDTH);
  const isResizing = ref(false);

  const applyCssVar = () => {
    document.documentElement.style.setProperty(CSS_VAR, `${width.value}px`);
  };

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width.value));
    } catch {
      // ignore（プライベートモード等）
    }
  };

  const setWidth = (px: number) => {
    width.value = clampWidth(px);
    applyCssVar();
  };

  onMounted(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    // 未保存なら null → Number(null) === 0 で下限に丸められるため、正数のときだけ復元する
    if (Number.isFinite(saved) && saved > 0) width.value = clampWidth(saved);
    applyCssVar();
  });

  const startResize = (event: PointerEvent) => {
    // ドラッグ中にテキスト選択が走らないようにする
    event.preventDefault();

    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = width.value;

    const onMove = (e: PointerEvent) => {
      // パネルは右端固定なので、左へ動かした分だけ幅が増える
      setWidth(startWidth + (startX - e.clientX));
    };

    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      handle.releasePointerCapture(event.pointerId);
      isResizing.value = false;
      document.body.style.cursor = '';
      persist();
    };

    handle.setPointerCapture(event.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);

    isResizing.value = true;
    // ハンドルから外れてもカーソル形状を維持する
    document.body.style.cursor = 'col-resize';
  };

  /** キーボード操作（← で拡大 / → で縮小） */
  const nudgeWidth = (direction: -1 | 1) => {
    setWidth(width.value + NUDGE_STEP * direction);
    persist();
  };

  /** ハンドルのダブルクリックで既定幅に戻す */
  const resetWidth = () => {
    setWidth(DEFAULT_WIDTH);
    persist();
  };

  return { width, isResizing, startResize, nudgeWidth, resetWidth };
};
