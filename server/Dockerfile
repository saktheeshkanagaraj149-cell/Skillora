# Production image for Render: the Node API plus the Cerbos PDP in one container,
# so authorization checks go over localhost and no second (paid) service is needed.
FROM ghcr.io/cerbos/cerbos:0.57.0 AS cerbos

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=cerbos /cerbos /usr/local/bin/cerbos
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional
COPY . .
ENV CERBOS_URL=http://127.0.0.1:3592 CERBOS_NO_TELEMETRY=1
# Cerbos runs in the background; if it dies, API checks fail closed (503) and /api/health reports it down.
CMD ["sh", "-c", "cerbos server --config=/app/cerbos/config.yaml --set=storage.disk.directory=/app/cerbos/policies --set=storage.disk.watchForChanges=false & exec node src/index.js"]
