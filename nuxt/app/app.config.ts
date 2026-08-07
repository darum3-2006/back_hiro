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
    // Select 系も同様。ただし既定の max-h-60 を残したいので min() で「既定 or 収まる高さ」の小さい方にする
    selectMenu: {
      slots: {
        content: 'max-h-[min(15rem,var(--reka-combobox-content-available-height))]',
      },
    },
    select: {
      slots: {
        content: 'max-h-[min(15rem,var(--reka-select-content-available-height))]',
      },
    },
  },
});
