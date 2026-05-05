// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],

  // 認証必須の社内ツールで SEO 不要のため SPA モード（CSR のみ）。
  // SSR/CSR 境界の API 呼び出し問題（baseURL 相対パス, Cookie 転送等）を回避。
  ssr: false,

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: false,
    },
  },
  devServer: {
    host: '0.0.0.0',
    port: 3100,
  },
});
