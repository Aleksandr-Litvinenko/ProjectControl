# ProjectControl

**Рабочее место проектного офиса (PMO).** Веб-приложение для контроля портфеля проектов: состояние документации и чек-листов, сроки (диаграмма Ганта), загрузка специалистов и прогноз выполнения.

---

## Для кого

Руководителю проектного офиса нужно видеть **все** проекты, их здоровье, документацию, сроки и загрузку людей. Руководители проектов (РП) ведут свои проекты по обязательному чек-листу. Специалисты, наблюдатели и заказчики видят только то, что им назначено.

## Роли (RBAC)

| Роль | Код | Кратко |
|---|---|---|
| Руководитель ПО / Админ | `pmo_admin` | Видит всё. Заводит пользователей, назначает доступы и РП, ведёт типы проектов и шаблоны чек-листов, выполняет вторую ступень приёмки, видит дашборд портфеля и аудит-лог. |
| Руководитель проекта | `pm` | Ведёт только назначенные проекты: документы, чек-лист, статусы, сроки/этапы, загрузка специалистов, отметка «Готов». |
| Специалист | `specialist` | Видит проекты-участия и свою загрузку, отмечает прогресс своих задач. |
| Наблюдатель | `observer` | Read-only по назначенным проектам. |
| Заказчик | `client` | Read-only, ограниченный вид (без внутренней загрузки специалистов и внутренних заметок). |

Аутентификация — **логин + пароль** (bcrypt), сессия в **httpOnly-cookie** (подписанный JWT). Самостоятельной регистрации нет: пользователей создаёт админ. Доступ к проекту назначается вручную (`ProjectAccess`).

## Основные возможности

- **Дашборд портфеля:** KPI (активные проекты, % документации, проекты в риске, просроченные пункты, перегруженные специалисты), таблица проектов с прогрессом/здоровьем/сроками, фильтры, экспорт в **Excel** и **PDF**.
- **Страница проекта:** обзор и метрики, чек-лист с документами (загрузка/версии/скачивание), двухступенчатая приёмка, диаграмма Ганта (этапы, задачи, вехи), загрузка специалистов с алертом перегруза, команда и доступы.
- **Чек-листы по типам проектов:** шаблон подставляется по типу (1С:БП/ЗУП/УТ/ERP/УНФ, Интеграция). Обязательные пункты: Устав, Проект, План.
- **Файлы:** локальное хранение с версионированием, скачивание только при доступе к проекту.
- **Аудит-лог** действий, индикатор здоровья 🟢/🟡/🔴, прогноз план/факт.

## Стек

- **Backend:** Node.js 20 (LTS) · TypeScript · Express · Prisma ORM · PostgreSQL 16
- **Frontend:** React · TypeScript · Vite · Tailwind CSS · react-router · TanStack Query
- **Файлы:** multer, локальное хранилище (`storage/`)
- **Экспорт:** `exceljs` (xlsx), `pdfkit`/`puppeteer` (pdf) — см. ARCHITECTURE
- **Деплой:** Docker Compose (db, api, web) за host-nginx (reverse-proxy + HTTPS Let's Encrypt) на `projectcrm.ru`

## Структура репозитория

```
ProjectControl/
├─ apps/
│  ├─ api/                # Express + Prisma (backend)
│  │  ├─ prisma/          # schema.prisma, миграции, seed
│  │  └─ src/             # роуты, middleware, сервисы, расчёты
│  └─ web/                # React + Vite + Tailwind (frontend)
│     └─ src/             # страницы, компоненты, api-клиент
├─ deploy/                # nginx-конфиг сайта, скрипты деплоя
├─ storage/               # локальные файлы проектов (вне git)
├─ docker-compose.yml     # прод-стек
├─ .env.example
├─ README.md · DECISIONS.md · ARCHITECTURE.md
```

## Локальный запуск (для разработки)

> На проде всё крутится в Docker. Для локальной разработки нужен Node 20 и PostgreSQL (или только Docker).

### Вариант А — через Docker (рекомендуется)

```bash
cp .env.example .env          # заполнить секреты
docker compose up -d --build  # поднимет db + api + web
# web: http://localhost:8080  api: http://localhost:4000
```

Миграции и seed применяются автоматически при старте api (entrypoint). Вручную:

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
```

### Вариант Б — нативно

```bash
# 1) Поднять PostgreSQL и создать БД, прописать DATABASE_URL в apps/api/.env
# 2) API
cd apps/api && npm install && npx prisma migrate dev && npm run seed && npm run dev
# 3) WEB (в другом терминале)
cd apps/web && npm install && npm run dev   # http://localhost:5173 (проксирует /api)
```

## Переменные окружения

См. `.env.example`. Ключевые: `DATABASE_URL`, `SESSION_SECRET`, `POSTGRES_*`, `MAX_UPLOAD_MB`, `PUBLIC_DOMAIN`, `COOKIE_SECURE`, пороги `HEALTH_*`.

## Деплой на projectcrm.ru

Развёрнуто и доступно: **https://projectcrm.ru**

### Особенности целевого сервера (важно)
1. **Docker bridge-сеть на хосте сломана** (нет предустановленной сети `bridge`, не работает DNS контейнеров). Поэтому образы собираются с `--network=host`, а `api`/`web` работают в `network_mode: host`; `db` — отдельный контейнер с публикацией `127.0.0.1:5433`, к которому API обращается по loopback. Подробности — `DECISIONS.md` (D15).
2. **Публичный HTTPS терминирует edge-прокси провайдера** (Jino) своим wildcard-сертификатом `*.projectcrm.ru` и проксирует на origin:80. Поэтому на origin нет редиректа на HTTPS (иначе цикл). Свой Let's Encrypt-сертификат стоит в блоке `:443` для прямого доступа (D16).

### Первичная установка
```bash
# 1) Синхронизировать код на сервер
rsync -az --exclude=node_modules --exclude=.git --exclude=.env \
  ./ root@<server>:/opt/projectcontrol/
# 2) На сервере: создать .env (см. .env.example), сгенерировать секреты
ssh root@<server>
cd /opt/projectcontrol && cp .env.example .env && nano .env   # POSTGRES_PASSWORD, SESSION_SECRET
# 3) Поднять стек (сборка с network=host + up)
bash deploy/deploy.sh --seed      # --seed только при первом запуске
# 4) host-nginx: сайт уже в /etc/nginx/sites-available/projectcontrol (см. deploy/nginx-projectcrm.conf)
#    Сертификат: certbot --nginx -d projectcrm.ru -d www.projectcrm.ru
```

### Обновление (выкладка новой версии)
```bash
rsync -az --exclude=node_modules --exclude=.git --exclude=.env ./ root@<server>:/opt/projectcontrol/
ssh root@<server> 'cd /opt/projectcontrol && bash deploy/deploy.sh'
# миграции применяются автоматически при старте api (entrypoint: prisma migrate deploy)
```

Соседние сайты (`game.*`, `gamecodex.*`) деплоем **не затрагиваются**. Файлы (`storage`) и БД (`pc_db_data`) — в Docker volumes, переживают пересборку.

### Демо-доступ
Логин `admin` / пароль `Admin#2026` (полный список — `DECISIONS.md`). Сменить на проде.

## Документация

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — модель данных (ERD), схема прав, формулы расчётов.
- [`DECISIONS.md`](./DECISIONS.md) — журнал решений и допущений, инспекция окружения, seed-доступы.
