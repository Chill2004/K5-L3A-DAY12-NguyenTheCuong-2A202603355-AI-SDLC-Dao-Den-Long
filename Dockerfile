# Đảo Đèn Lồng: game (web), headless và soak trong một image Node.
#   docker build -t dao-den-long .
#   docker run --rm -p 4173:4173 dao-den-long                      # chơi: http://localhost:4173
#   docker run --rm -v "$PWD/out:/out" dao-den-long node build/headless/cli.js --seed 1 --night 1 --ticks 600 --out /out/out.jsonl
#   docker run --rm -v "$PWD/out:/out" dao-den-long node --expose-gc --jitless build/headless/soak.js --seed 7 --nights 10 --out /out/soak.json
# Bench (bench_cmd) cần Chrome + GPU trên máy thật nên không chạy trong image này.
FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

ENV HOST=0.0.0.0 \
    DDL_DATA_DIR=/app/.data
EXPOSE 4173
VOLUME ["/app/.data"]
CMD ["node", "scripts/serve.mjs", "--port", "4173"]
