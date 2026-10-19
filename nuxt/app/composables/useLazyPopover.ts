/**
 * ポップオーバー（UPopover / UDropdownMenu）の遅延生成。
 *
 * 一覧の各セルに置くと行数 × 列数ぶんの Popover が初回描画で生成され重いため、
 * 最初はトリガー（スロット）だけを描画し、ホバーまたはクリックされた時点で
 * 本物の Popover に差し替える。クリックで生成した場合はそのまま開く。
 *
 * 使い方:
 *   const { activated, open, prewarm, activateAndOpen } = useLazyPopover();
 *   // template:
 *   //   <span v-if="!activated" class="contents" @pointerover="prewarm" @click="activateAndOpen">
 *   //     <slot />
 *   //   </span>
 *   //   <UPopover v-else v-model:open="open">...</UPopover>
 */
export const useLazyPopover = () => {
  const activated = ref(false);
  const open = ref(false);

  /** ホバー時に先行生成する（開きはしない）。続くクリックは本物のトリガーが受ける */
  const prewarm = () => {
    activated.value = true;
  };

  /** ホバーを経ないクリック（キーボード・タッチ）では生成してそのまま開く */
  const activateAndOpen = () => {
    activated.value = true;
    open.value = true;
  };

  return { activated, open, prewarm, activateAndOpen };
};
