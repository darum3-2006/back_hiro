FROM nginx:1.31.9-alpine

ENV TZ=Asia/Tokyo
ARG NGINX_DEFAULT_CONF

COPY default.conf /etc/nginx/conf.d/default.conf

# nginx 起動前に走る初期化スクリプト（公式イメージの docker-entrypoint.sh が実行する）
COPY docker-entrypoint.d/ /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/*.sh

EXPOSE 80
