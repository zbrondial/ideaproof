FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run setup && npm run build

ENV NODE_ENV=production
ENV IDEAPROOF_DATA_DIR=/app/data

EXPOSE 3000

CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
