#!/usr/bin/env bash
# ローカルで nest build し、Amazon Linux 2023 サーバへ dist を転送、
# 本番依存を install してマイグレーションを適用後、PM2 で再起動する。
#
# 使い方:
#   ./deploy.sh <ssh-destination>
# 例:
#   ./deploy.sh ec2-user@app.example.com
#
# 前提:
#   - 転送先サーバに node, pnpm, pm2 が入っていること
#   - 転送先 ~/nest/.env が事前に配置されていること（このスクリプトでは触らない）
#   - ホームディレクトリ直下の ~/nest/ に展開する

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <ssh-destination>" >&2
  exit 1
fi

DEST="$1"
APP_NAME="back_hiro-nest"
REMOTE_DIR="nest"

cd "$(dirname "$0")"

echo "==> ローカルビルド"
pnpm install --frozen-lockfile
pnpm build

echo "==> dist / package.json / pnpm-lock.yaml を $DEST:~/$REMOTE_DIR/ に rsync"
ssh "$DEST" "mkdir -p '$REMOTE_DIR'"
rsync -avz --delete dist "$DEST:$REMOTE_DIR/"
rsync -avz package.json pnpm-lock.yaml "$DEST:$REMOTE_DIR/"

echo "==> リモートで install / migration / PM2 再起動"
ssh "$DEST" bash -s <<EOF
set -euo pipefail
cd "\$HOME/$REMOTE_DIR"
# pnpm v10+ はビルドスクリプトをデフォルトでブロックし、ignored builds で
# install が非ゼロ終了する。後段の npm rebuild でリカバリするため許容する。
pnpm install --prod --frozen-lockfile || true
# bcrypt はネイティブバインディングが必須。pnpm の制限に関わらず npm rebuild
# で確実に構築する（npm は同等の制限を持たない）。
npm rebuild bcrypt
# pnpm 11 はスクリプト実行前に dep status check を走らせ、devDeps が無いと
# 勝手に full install しようとする。typeorm CLI を直接叩いて回避。
./node_modules/.bin/typeorm -d ./dist/data-source.js migration:run
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME"
else
  pm2 start dist/main.js --name "$APP_NAME"
fi
pm2 save
EOF

echo "==> nest deploy 完了"
