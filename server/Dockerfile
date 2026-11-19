# Production image for Render and self-hosting: the Node API plus the Cerbos PDP in one container,
# so authorization checks go over localhost and no second (paid) service is needed.
FROM ghcr.io/cerbos/cerbos:0.57.0 AS cerbos

FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000 \
    CERBOS_URL=http://127.0.0.1:3592 \
    CERBOS_NO_TELEMETRY=1

COPY --from=cerbos /cerbos /usr/local/bin/cerbos
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional
COPY . .

# Run as the unprivileged user that ships with the node image, not root.
USER node

EXPOSE 5000

# /api/health returns 503 when MongoDB or Cerbos is down, so this catches both.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Waits for Cerbos, then starts the API. If either dies, the container exits and is restarted.
CMD ["node", "docker-start.mjs"]
