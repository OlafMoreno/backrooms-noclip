FROM node:22-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY game/ ./game/
COPY pipeline/ ./pipeline/
COPY data/ ./data/

ENV NODE_ENV=production
EXPOSE 8080

CMD ["sh", "-c", "cd /app/server && node --watch server.js"]