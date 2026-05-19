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

  // マスタ（ステータス/優先度/タグ）で選択可能な色を拡張。
  // Tailwind パレット名と一致する色は自動的に palette が解決される。
  ui: {
    theme: {
      colors: [
        'primary',
        'secondary',
        'success',
        'info',
        'warning',
        'error',
        'rose',
        'sky',
        'amber',
        'fuchsia',
        'emerald',
        'violet',
      ],
    },
  },

  // 実行環境ラベル。空ならバッジを出さない（本番想定）。
  // NUXT_PUBLIC_ENV_LABEL=local 等で上書きする。
  runtimeConfig: {
    public: {
      envLabel: '',
    },
  },

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
