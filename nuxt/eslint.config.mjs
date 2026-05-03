// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Vue 3 はマルチルートテンプレート対応
    'vue/no-multiple-template-root': 'off'
  }
})
