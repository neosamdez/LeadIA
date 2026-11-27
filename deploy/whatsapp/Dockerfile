FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node webhook.mjs worker.mjs ai.mjs .
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "webhook.mjs"]
