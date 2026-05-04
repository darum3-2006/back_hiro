FROM nginx:1.29.8-alpine

ENV TZ=Asia/Tokyo
ARG NGINX_DEFAULT_CONF

COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
