/**
 * IME 変換中の F8 を、トースト通知のショートカットに渡さない。
 *
 * reka-ui の ToastViewport（Nuxt UI の UApp が常設する UToaster の中身）は、F8 を
 * 「通知領域へフォーカスを移す」ホットキーとして window の keydown で拾う（Nuxt UI からは
 * 変更できない）。日本語 IME では F8 は「半角カナ/半角への変換」なので、変換中に押すと
 * フォーカスが一瞬入力欄から外れて変換が全角のまま確定し、戻ったあとも変換の下線が残るなど
 * 入力が壊れる（検索ダイアログでは検索語も追従しなくなっていた）。
 *
 * window の capture 段階で、変換中（isComposing / keyCode 229）の F8 だけ伝播を止める。
 * IME 自体の変換は keydown の配信前に処理されるので影響しない。変換中でない F8 は
 * 従来どおり通知領域へのフォーカス移動に使える。
 */
export default defineNuxtPlugin(() => {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'F8' && (e.isComposing || e.keyCode === 229)) e.stopPropagation();
    },
    { capture: true },
  );
});
