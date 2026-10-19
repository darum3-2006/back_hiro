/**
 * ポップオーバー（UPopover / UDropdownMenu）の遅延生成。
 *
 * 一覧の各セルに置くと行数 × 列数ぶんの Popover が初回描画で生成され重いため、
 * 最初はトリガー（スロット）だけを描画し、クリックされた時点で本物の Popover に
 * 差し替えて開く。
 *
 * 差し替えは click（ジェスチャ完了後）で行う。pointerover / pointerdown で差し替えると、
 * 操作の途中でトリガー要素が入れ替わり、タッチでの初回タップが新しいトリガーに
 * 届かない・フォーカス中の要素が消える、といった問題が起きるため。
 *
 * 使い方:
 *   const { activated, open, activate } = useLazyPopover();
 *   // template:
 *   //   <span v-if="lazy && !activated" class="contents" @click="activate"><slot /></span>
 *   //   <UPopover v-else v-model:open="open">...</UPopover>
 */
export const useLazyPopover = () => {
  const activated = ref(false);
  const open = ref(false);

  /** 本物の Popover を生成し、開いた状態でマウントする */
  const activate = () => {
    activated.value = true;
    open.value = true;
  };

  return { activated, open, activate };
};
