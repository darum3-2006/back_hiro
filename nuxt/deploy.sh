#!/usr/bin/env bash
# ローカルで nuxt build し、Amazon Linux 2023 サーバへ .output を転送して PM2 で再起動する。
#
# 使い方:
#   ./deploy.sh <ssh-destination>
# 例:
#   ./deploy.sh ec2-user@app.example.com
#
# 前提:
#   - 転送先サーバに node, pm2 が入っていること
#   - Nuxt は ssr: false の SPA で .output は self-contained のため install は不要
#   - ホームディレクトリ直下の ~/nuxt/ に展開する
#   - 転送先の ~/nuxt/.env に環境固有の値を用意しておくこと（NUXT_PUBLIC_GOOGLE_CLIENT_ID 等）。
#     .env は転送しない（環境ごとに各サーバが保持）。ecosystem.config.cjs が起動時に読み込む。

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <ssh-destination>" >&2
  exit 1
fi

DEST="$1"
APP_NAME="back_hiro-nuxt"
REMOTE_DIR="nuxt"

cd "$(dirname "$0")"

echo "==> ローカルビルド"
pnpm install --frozen-lockfile
# NUXT_PUBLIC_* はビルド時には焼き込まれず、node サーバ起動時に runtimeConfig を
# 上書きする方式。本番値は ecosystem.config.cjs の env で設定するため、ここでは
# ローカル .env に依存しない素のビルドで良い。
pnpm build

echo "==> .output と ecosystem.config.cjs を $DEST:~/$REMOTE_DIR/ に rsync"
ssh "$DEST" "mkdir -p '$REMOTE_DIR'"
rsync -avz --delete .output "$DEST:$REMOTE_DIR/"
rsync -avz ecosystem.config.cjs "$DEST:$REMOTE_DIR/"

echo "==> リモートで PM2 再起動"
ssh "$DEST" bash -s <<EOF
set -euo pipefail
cd "\$HOME/$REMOTE_DIR"
# ecosystem.config.cjs から PORT などの env を読む。
# reload は env を再読込しないため、ポート変更を反映するには delete → start。
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 delete "$APP_NAME"
fi
pm2 start ecosystem.config.cjs
pm2 save
EOF

echo "==> nuxt deploy 完了"
