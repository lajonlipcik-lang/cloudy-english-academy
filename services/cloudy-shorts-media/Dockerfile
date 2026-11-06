FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs ./server.mjs
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

USER node
CMD ["node", "server.mjs"]
