#!/usr/bin/env bash
# ProjectControl — деплой/обновление на сервере.
# Запускать из каталога проекта на сервере (/opt/projectcontrol).
#
#   bash deploy/deploy.sh           # сборка + перезапуск стека
#   bash deploy/deploy.sh --seed    # то же + (пере)сев демо-данных
#
# Порты слушаются на 127.0.0.1; внешний вход и TLS даёт host-nginx.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "✖ Нет .env (скопируйте из .env.example и заполните)"; exit 1
fi

# На этом хосте предопределённая сеть docker 'bridge' отсутствует, поэтому
# build выполняем с сетью host (см. DECISIONS D15).
BUILD_NET="${BUILD_NET:-host}"

# Грузим переменные (нужен VITE_API_BASE на сборку web)
set -a; . ./.env; set +a

# compose build не пробрасывает --network, а предопределённая сеть 'bridge'
# на этом хосте отсутствует — поэтому собираем образы напрямую с network=host
# и теми же тегами, что заданы в image: docker-compose.yml.
echo "▶ Сборка образов (network=$BUILD_NET)…"
docker build --network="$BUILD_NET" -t projectcontrol-api ./apps/api
docker build --network="$BUILD_NET" --build-arg VITE_API_BASE="${VITE_API_BASE:-/api}" -t projectcontrol-web ./apps/web

echo "▶ Запуск стека (без пересборки — образы уже собраны)…"
docker compose up -d --no-build

echo "▶ Ожидание готовности API…"
for i in $(seq 1 30); do
  if curl -fs http://127.0.0.1:4000/api/health >/dev/null 2>&1; then echo "  API готов"; break; fi
  sleep 2
done

if [ "${1:-}" = "--seed" ]; then
  echo "▶ Seed демо-данных…"
  docker compose exec -T api npm run seed || echo "  seed: пропущен/ошибка"
fi

echo "▶ Состояние:"
docker compose ps
echo "✔ Готово. web: http://127.0.0.1:8080  api: http://127.0.0.1:4000/api/health"
