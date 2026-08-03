# Карта доступа к API

Собрано автоматически из `apps/api/src`:
`node tools/audit-routes.mjs --markdown docs/ACCESS-MAP.md`.
Руками не правьте — файл перезаписывается целиком.

Маршрутов: **52**.

## `routes/admin/projectTypes.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/admin/project-types` | только pmo_admin |
| POST | `/api/admin/project-types` | только pmo_admin |
| DELETE | `/api/admin/project-types/:id` | только pmo_admin |
| PATCH | `/api/admin/project-types/:id` | только pmo_admin |

## `routes/admin/templates.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/admin/templates` | только pmo_admin |
| POST | `/api/admin/templates` | только pmo_admin |
| DELETE | `/api/admin/templates/:id` | только pmo_admin |
| PUT | `/api/admin/templates/:id` | только pmo_admin |

## `routes/admin/users.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/admin/users` | только pmo_admin |
| POST | `/api/admin/users` | только pmo_admin |
| PATCH | `/api/admin/users/:id` | только pmo_admin |
| POST | `/api/admin/users/:id/reset-password` | только pmo_admin |

## `routes/allocations.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/allocations` | любой вошедший, выборка урезана по доступу |
| POST | `/api/projects/:id/allocations` | любой вошедший, право записи в проект |
| DELETE | `/api/projects/:id/allocations/:allocId` | любой вошедший, право записи в проект |
| PATCH | `/api/projects/:id/allocations/:allocId` | любой вошедший, право записи в проект |

## `routes/audit.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/audit` | только pmo_admin |

## `routes/auth.ts`

| Метод | Путь | Кто может |
|---|---|---|
| POST | `/api/auth/change-password` | любой вошедший |
| POST | `/api/auth/login` | **без охраны** |
| POST | `/api/auth/logout` | **без охраны** |
| GET | `/api/auth/me` | любой вошедший |

## `routes/catalog.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/catalog/project-types` | любой вошедший |
| GET | `/api/catalog/project-types/:id/template` | любой вошедший |

## `routes/checklist.ts`

| Метод | Путь | Кто может |
|---|---|---|
| POST | `/api/projects/:id/checklist` | любой вошедший, право записи в проект |
| DELETE | `/api/projects/:id/checklist/:itemId` | любой вошедший, право записи в проект |
| PATCH | `/api/projects/:id/checklist/:itemId` | любой вошедший, право записи в проект |
| POST | `/api/projects/:id/checklist/:itemId/accept` | только pmo_admin |
| POST | `/api/projects/:id/checklist/:itemId/documents` | любой вошедший, право записи в проект |
| POST | `/api/projects/:id/checklist/:itemId/ready` | любой вошедший, право записи в проект |
| POST | `/api/projects/:id/checklist/:itemId/reject` | только pmo_admin |
| DELETE | `/api/projects/:id/documents/:docId` | любой вошедший, право записи в проект |
| GET | `/api/projects/:id/documents/:docId/download` | любой вошедший, доступ к проекту |

## `routes/dashboard.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/dashboard` | любой вошедший, выборка урезана по доступу |

## `routes/export.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/export/dashboard.pdf` | любой вошедший, выборка урезана по доступу |
| GET | `/api/export/dashboard.xlsx` | любой вошедший, выборка урезана по доступу |

## `routes/projects.ts`

| Метод | Путь | Кто может |
|---|---|---|
| GET | `/api/projects` | любой вошедший, выборка урезана по доступу |
| POST | `/api/projects` | только pmo_admin |
| DELETE | `/api/projects/:id` | только pmo_admin |
| GET | `/api/projects/:id` | любой вошедший, доступ к проекту |
| PATCH | `/api/projects/:id` | любой вошедший, право записи в проект |
| GET | `/api/projects/:id/access` | любой вошедший, доступ к проекту |
| POST | `/api/projects/:id/access` | только pmo_admin |
| DELETE | `/api/projects/:id/access/:userId` | только pmo_admin |
| POST | `/api/projects/:id/stages` | любой вошедший, право записи в проект |
| DELETE | `/api/projects/:id/stages/:stageId` | любой вошедший, право записи в проект |
| PATCH | `/api/projects/:id/stages/:stageId` | любой вошедший, право записи в проект |

## `routes/tasks.ts`

| Метод | Путь | Кто может |
|---|---|---|
| POST | `/api/projects/:id/milestones` | любой вошедший, право записи в проект |
| DELETE | `/api/projects/:id/milestones/:msId` | любой вошедший, право записи в проект |
| PATCH | `/api/projects/:id/milestones/:msId` | любой вошедший, право записи в проект |
| POST | `/api/projects/:id/tasks` | любой вошедший, право записи в проект |
| DELETE | `/api/projects/:id/tasks/:taskId` | любой вошедший, право записи в проект |
| PATCH | `/api/projects/:id/tasks/:taskId` | любой вошедший, право записи в проект |

---

**Обозначения.**

- «любой вошедший» — нужна сессия, роль не проверяется;
- «доступ к проекту» — есть запись в `ProjectAccess` (у `pmo_admin` — всегда);
- «право записи в проект» — `pmo_admin` либо назначенный РП именно этого проекта;
- «выборка урезана по доступу» — список приходит уже отфильтрованным по доступным проектам.

Охрана уровня роутера наследуется вложенными: например, вся админка закрыта
одним `router.use(requireRole('pmo_admin'))` в `routes/admin/index.ts`.

