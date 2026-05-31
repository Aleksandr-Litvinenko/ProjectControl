#!/bin/sh
set -e

echo "[entrypoint] Применяю миграции Prisma..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] Запускаю seed..."
  npm run seed || echo "[entrypoint] seed завершился с ошибкой (продолжаю)"
fi

echo "[entrypoint] Старт API..."
exec node dist/index.js
