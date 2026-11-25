FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_APP_MODE=demo
RUN npm run lint && npm run build

FROM nginx:stable-alpine AS production
ENV LEADIA_API_HOST=127.0.0.1:8089 NGINX_ENVSUBST_FILTER=LEADIA_API_HOST
COPY deploy/nginx.conf /etc/nginx/templates/default.conf.template
COPY --chmod=755 deploy/20-runtime-config.sh /docker-entrypoint.d/19-leadia-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
