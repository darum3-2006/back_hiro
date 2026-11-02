/**
 * モーダル / スライドオーバー内の入力で IME 変換をキャンセルする ESC により、
 * ダイアログ自体が閉じてしまうのを防ぐ。
 *
 * Reka UI は escapeKeyDown が preventDefault されていなければ dismiss するため、
 * 変換中の ESC だけ preventDefault する。content はポータル描画なので、
 * 開いている間だけ document の composition を監視する。
 * Safari は ESC での変換キャンセル時に compositionend → keydown(isComposing=false)
 * の順で発火するため、変換中を示す keyCode 229 も併せて判定する。
 *
 * 使い方:
 *   const onEscapeKeyDown = useDialogImeEscapeGuard(() => props.open);
 *   // template: <USlideover :content="{ onEscapeKeyDown }" ...>
 */
export const useDialogImeEscapeGuard = (isOpen: () => boolean | undefined) => {
  const composing = ref(false);
  const onCompositionStart = () => {
    composing.value = true;
  };
  const onCompositionEnd = () => {
    composing.value = false;
  };

  const bind = () => {
    document.addEventListener('compositionstart', onCompositionStart, true);
    document.addEventListener('compositionend', onCompositionEnd, true);
  };
  const unbind = () => {
    composing.value = false;
    document.removeEventListener('compositionstart', onCompositionStart, true);
    document.removeEventListener('compositionend', onCompositionEnd, true);
  };

  watch(
    isOpen,
    (open) => {
      if (!import.meta.client) return;
      if (open) bind();
      else unbind();
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    if (import.meta.client) unbind();
  });

  /** IME 変換中の ESC ではダイアログを閉じない */
  return (e: Event) => {
    const ke = e as KeyboardEvent;
    if (composing.value || ke.isComposing || ke.keyCode === 229) e.preventDefault();
  };
};
