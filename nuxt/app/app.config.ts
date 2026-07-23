export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate',
    },
    dropdownMenu: {
      slots: {
        // 項目が多いとき画面下で見切れないよう、収まる高さで頭打ちにして viewport 側をスクロールさせる
        content: 'max-h-(--reka-dropdown-menu-content-available-height)',
      },
    },
  },
});
