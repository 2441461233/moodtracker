FROM node:22-bookworm-slim

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100
WORKDIR /app
COPY --chown=node:node index.mjs transcription.mjs ./
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:" + process.env.PORT + "/health").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'
CMD ["node", "index.mjs"]
