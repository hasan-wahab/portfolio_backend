# Simple backend image (Node API)
FROM node:20-alpine

WORKDIR /app

# Dependencies pehle (Docker cache ke liye)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App code + data
COPY src ./src
COPY data ./data

ENV PORT=8787
EXPOSE 8787

CMD ["node", "src/server.js"]
