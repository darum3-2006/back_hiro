// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';
import prettier from 'eslint-config-prettier';

export default withNuxt({
  rules: {
    // Vue 3 はマルチルートテンプレート対応
    'vue/no-multiple-template-root': 'off',

    // Date を禁止して dayjs に統一する
    // - new Date(...)
    // - Date.now() / Date.parse(...) / Date.UTC(...)
    'no-restricted-syntax': [
      'error',
      {
        selector: 'NewExpression[callee.name="Date"]',
        message: 'Date は使わず dayjs() を使用してください',
      },
      {
        selector: 'CallExpression[callee.object.name="Date"]',
        message: 'Date.* は使わず dayjs を使用してください',
      },
    ],
    'no-restricted-globals': [
      'error',
      { name: 'Date', message: 'Date は使わず dayjs() を使用してください' },
    ],
  },
}).append(prettier);
