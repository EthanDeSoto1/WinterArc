FROM node:24-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:24-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-bookworm-slim
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/winter-arc.db
WORKDIR /app
COPY server/ ./server/
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY --from=client-build /app/client/dist ./client/dist
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/server
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/index.js"]
