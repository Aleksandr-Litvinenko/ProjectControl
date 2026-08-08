# ARCHITECTURE — модель данных, права, расчёты

## 1. Общая схема

```
[ Браузер ]
   │  HTTPS (projectcrm.ru)
   ▼
[ host-nginx ]  ── TLS (Let's Encrypt), reverse-proxy
   │  proxy_pass 127.0.0.1:8080
   ▼
[ web (nginx в Docker) ]  ── статика React + проксирует /api → api:4000
   │
   ▼
[ api (Express) ] ──Prisma──> [ db (PostgreSQL 16) ]
   │
   └── storage/ (локальные файлы, Docker volume)
```

Другие виртуальные хосты сервера обслуживаются отдельно и не входят в область этой архитектуры.

---

## 2. Модель данных (ERD, текстом)

```
User 1───* ProjectAccess *───1 Project
User 1───* Project (createdBy)
User 1───* Project (как РП, через ProjectAccess.accessRole=pm или Project.pmUserId)

ProjectType 1───* Project
ProjectType 1───* ChecklistTemplate 1───* ChecklistTemplateItem

Project 1───* Stage
Project 1───* ChecklistItem *───0..1 Stage
Project 1───* Task          *───0..1 Stage
Project 1───* Milestone
Project 1───* Allocation *───1 User (specialist)
Project 1───* Document
ChecklistItem 1───* Document   (версии: version+1 при перезагрузке)

User 1───* AuditLog
```

### Сущности (поля — кратко; полный источник истины — `apps/api/prisma/schema.prisma`)

- **User**: id, fullName, email, login (uniq), passwordHash, role (`pmo_admin|pm|specialist|observer|client`), isActive, createdAt.
- **ProjectType**: id, name, description.
- **Project**: id, title, client (название компании), projectTypeId, description, status (`planned|active|on_hold|done|cancelled`), startDate, plannedEndDate, actualEndDate, createdById, pmUserId(nullable).
- **ProjectAccess**: id, projectId, userId, accessRole. Уникальность (projectId, userId).
- **Stage**: id, projectId, name, order, startDate, endDate, status.
- **ChecklistTemplate**: id, projectTypeId, name.
- **ChecklistTemplateItem**: id, templateId, title, docType (`charter|project|plan|tz|kp|report|protocol|regulation|other`), mandatory, stageHint, requiresPmoApproval, defaultOrder.
- **ChecklistItem**: id, projectId, stageId?, title, docType, mandatory, status (`not_started|in_progress|ready|in_review|accepted|overdue`), deadline?, responsibleUserId?, requiresPmoApproval, acceptedById?, acceptedAt?, order.
- **Document**: id, checklistItemId?, projectId, originalName, storedPath, mimeType, sizeBytes, version, uploadedById, uploadedAt.
- **Task**: id, projectId, stageId?, title, assigneeUserId?, startDate?, endDate?, progressPercent (0–100, вручную), status.
- **Milestone**: id, projectId, title, date, reached.
- **Allocation**: id, projectId, userId, periodStart, periodEnd, hoursPerDay, occupancyPercent (вручную).
- **AuditLog**: id, userId, action, entityType, entityId, payload(json), createdAt.

---

## 3. Права (RBAC) и скоуп

- Аутентификация: JWT в httpOnly-cookie. Middleware `requireAuth` кладёт `req.user`.
- **Скоуп проектов** (`accessibleProjectIds(user)`):
  - `pmo_admin` → все проекты.
  - остальные → проекты, где есть запись `ProjectAccess(userId=...)`.
- Проверки на каждом эндпоинте (`requireRole`, `requireProjectAccess`, `requireProjectWrite`):
  - Запись в проект (документы, чек-лист, сроки, загрузка): только `pmo_admin` и `pm`-владелец проекта.
  - Вторая ступень приёмки (`in_review → accepted`): только `pmo_admin`.
  - `specialist`: чтение своих проектов + правка `progressPercent` своих задач.
  - `observer`: только чтение.
  - `client`: только чтение + урезанная сериализация (без `Allocation` и внутренних заметок).
- Любая мутация пишет `AuditLog`.

---

## 4. Расчёты (единые функции в `apps/api/src/services/metrics.ts`)

### Прогресс проекта
```
если есть задачи: progress = avg(task.progressPercent)
иначе:            progress = accepted_обязательных / всего_обязательных * 100
```

### Заполненность документации
```
docFill        = accepted_пунктов / всего_пунктов
mandatoryFill  = accepted_обязательных / всего_обязательных
```

### Просрочка пункта
```
overdue, если deadline < now И status != accepted
(вычисляется на лету; в выдаче статус показывается как overdue)
```

### Прогноз (план vs факт)
```
elapsedRatio  = (now - startDate) / (plannedEndDate - startDate)   // 0..1
expected      = elapsedRatio * 100
deltaDays     = (progress - expected)/100 * длительность_плана_в_днях
deltaDays > 0 → опережение, < 0 → отставание
```

### Индикатор здоровья
```
🔴 (risk), если хотя бы одно:
   - есть просроченный ОБЯЗАТЕЛЬНЫЙ пункт чек-листа;
   - plannedEndDate < now, а проект не done/cancelled;
   - перегруз специалиста > HEALTH_OVERLOAD_RED_PCT (120%) в текущей неделе.
🟡 (warn), если хотя бы одно (и не 🔴):
   - у обязательного пункта дедлайн в ближайшие HEALTH_DEADLINE_SOON_DAYS (7) дней и он не accepted;
   - фактический прогресс отстаёт от ожидаемого по сроку (deltaDays < 0);
   - на текущем этапе не заполнены обязательные документы.
🟢 (ok) — иначе.
```
Пороги — из env (`HEALTH_*`), дефолты см. `DECISIONS.md` D10.

---

## 5. Файлы

- Путь: `storage/projects/{projectId}/{checklistItemId}/{version}__{safeName}`.
- Лимит `MAX_UPLOAD_MB` (25), белый список MIME/расширений, имена санитизируются.
- Версионирование: повторная загрузка к тому же пункту → `version+1`, прежние сохраняются.
- Скачивание — только через API с проверкой доступа к проекту; прямых публичных URL нет.
- В Docker `storage` — это volume (`pc_storage`), переживает пересборку.

---

## 6. Аудит

Каждая мутация → `AuditLog(userId, action, entityType, entityId, payload, createdAt)`. Экран аудита (`pmo_admin`) с фильтром по пользователю/типу сущности.
