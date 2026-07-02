/**
 * 入力欄の IME ガード。変換確定の Enter・変換キャンセルの ESC を、本来の
 * 確定/取消操作と区別するための共通処理。
 *
 * keydown 時点では compositionend より前なので composing フラグは true のまま。
 * ブラウザ差を吸収するため `e.isComposing` も併用する。
 *
 * 使い方:
 *   const { onCompositionStart, onCompositionEnd, onEnter, onEscape } = useImeGuard();
 *   const onSubmit = onEnter(commit);
 *   const onCancel = onEscape(cancel, { stop: true });
 *   // template: @compositionstart / @compositionend / @keydown.enter="onSubmit" ...
 */
export const useImeGuard = () => {
  const composing = ref(false);
  const onCompositionStart = () => {
    composing.value = true;
  };
  const onCompositionEnd = () => {
    composing.value = false;
  };
  const isComposing = (e: KeyboardEvent): boolean => composing.value || e.isComposing;

  /** IME 変換確定の Enter を無視して fn を実行するハンドラを返す。 */
  const onEnter = (fn: () => void) => (e: KeyboardEvent) => {
    if (isComposing(e)) return;
    e.preventDefault();
    fn();
  };

  /**
   * IME 変換キャンセルの ESC を無視して fn を実行するハンドラを返す。
   * stop=true で常に stopPropagation（親のモーダル/スライドインが閉じるのを防ぐ）。
   */
  const onEscape =
    (fn: () => void, opts: { stop?: boolean } = {}) =>
    (e: KeyboardEvent) => {
      if (opts.stop) e.stopPropagation();
      if (isComposing(e)) return;
      e.preventDefault();
      fn();
    };

  return { composing, onCompositionStart, onCompositionEnd, isComposing, onEnter, onEscape };
};
