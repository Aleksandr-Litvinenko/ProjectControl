# ProjectControl API — Express + Prisma
FROM node:20-alpine

WORKDIR /app

# Системные зависимости для prisma engines на alpine
RUN apk add --no-cache openssl

# Установка зависимостей. NODE_ENV не выставляем в production на этапе сборки,
# иначе npm пропустит devDependencies (tsc/tsx/prisma CLI), которые нужны
# и для сборки, и в рантайме (prisma migrate deploy, seed через tsx).
COPY package*.json ./
RUN npm install --include=dev

# Генерация Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Сборка TS -> dist (+ копирование assets, напр. шрифта для PDF)
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Точка входа: миграции (+опц. seed) -> запуск
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/storage

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
