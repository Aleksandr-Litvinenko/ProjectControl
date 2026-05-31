# ProjectControl API — Express + Prisma
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Системные зависимости для prisma engines на alpine
RUN apk add --no-cache openssl

# Установка зависимостей (включая dev: нужны prisma CLI, tsx, typescript)
COPY package*.json ./
RUN npm install

# Генерация Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Сборка TS -> dist
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Точка входа: миграции (+опц. seed) -> запуск
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/storage

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
