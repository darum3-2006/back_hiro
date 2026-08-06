#!/bin/sh
# host.docker.internal の AAAA（IPv6）レコードを /etc/hosts から除去する。
#
# Docker Desktop は host.docker.internal に IPv4 / IPv6 の両方を登録するが、
# コンテナから IPv6 gateway (fdc4:...::254) への経路がないため接続は必ず失敗する。
# nginx は起動時に proxy_pass のホスト名を解決して「2 台構成の upstream グループ」
# として扱うので、
#
#   - IPv6 側は常時 down 扱い（connect() failed: Network unreachable）
#   - Vite の deps 再バンドル等で IPv4 側が一瞬こけると max_fails=1 で down 判定
#   - 全滅 → "no live upstreams" → fail_timeout(既定10秒)の間すべて即 502
#
# となり、Nuxt が復帰済みでも 10 秒間画面が読み込めなくなる。
# レコードを 1 つに減らすと「グループ内が 1 台なら max_fails / fail_timeout を
# 無視し、決して利用不可とみなさない」という nginx の特例が効くようになる。
#
# 注意: /etc/hosts は bind mount のため mv では置き換えられない。中身を上書きする。

set -u

HOSTS=/etc/hosts
TMP=/tmp/hosts.stripped

if awk '!($1 ~ /:/ && $2 == "host.docker.internal")' "$HOSTS" > "$TMP" 2>/dev/null &&
	[ -s "$TMP" ] &&
	cat "$TMP" > "$HOSTS" 2>/dev/null; then
	echo "10-strip-ipv6-hosts.sh: removed IPv6 host.docker.internal entry from $HOSTS"
else
	# 失敗しても nginx の起動は妨げない（IPv6 フォールバックで動作自体は継続するため）
	echo "10-strip-ipv6-hosts.sh: could not rewrite $HOSTS, skipping" >&2
fi

rm -f "$TMP"
exit 0
