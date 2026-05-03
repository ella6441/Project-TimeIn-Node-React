FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD npx prisma db push && node dist/main
