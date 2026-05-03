FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma/ ./prisma/
COPY nest-cli.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY src/ ./src/

RUN npx prisma generate && ls src/generated/prisma/
RUN npm run build && ls dist/
RUN ls dist/main.js

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && node dist/main"]
