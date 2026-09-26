# Imagen de producción: Node sin paso de build (JS plano) y SQLite integrado en Node.
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/malos.db

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY scripts ./scripts

# La base de datos vive en un volumen; el usuario "node" (uid 1000) viene con la imagen.
RUN mkdir -p /app/data && chown node:node /app/data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
