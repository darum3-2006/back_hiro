// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';
import prettier from 'eslint-config-prettier';

export default withNuxt({
  rules: {
    // Vue 3 はマルチルートテンプレート対応
    'vue/no-multiple-template-root': 'off'
  }
}).append(prettier);
