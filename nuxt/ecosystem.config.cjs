const fs = require('node:fs');
const path = require('node:path');

// 本番の node サーバ（.output/server/index.mjs）は .env を自動では読まない。
// 一方 NUXT_PUBLIC_* はサーバ起動時に runtimeConfig を上書きし、SPA でもサーバが
// 配信ペイロードへ注入する。そこで PM2 起動時にこのファイルが同ディレクトリの .env を
// 読み取り、env として渡す。環境依存の値はリポジトリに置かず各環境の .env（gitignore 済み）で用意する。
const loadDotenv = () => {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq === -1) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
};

module.exports = {
  apps: [
    {
      name: 'back_hiro-nuxt',
      script: '.output/server/index.mjs',
      env: {
        PORT: 3100,
        // 各環境の .env から NUXT_PUBLIC_GOOGLE_CLIENT_ID / NUXT_PUBLIC_ENV_LABEL 等を取り込む。
        ...loadDotenv(),
      },
    },
  ],
};
