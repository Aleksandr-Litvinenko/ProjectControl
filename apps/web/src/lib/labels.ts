import type { Role, ProjectStatus, ChecklistStatus, DocType, TaskStatus, StageStatus, Health } from './types';

export const ROLE_LABELS: Record<Role, string> = {
  pmo_admin: 'Руководитель ПО',
  pm: 'Руководитель проекта',
  specialist: 'Специалист',
  observer: 'Наблюдатель',
  client: 'Заказчик',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Планируется',
  active: 'В работе',
  on_hold: 'Пауза',
  done: 'Завершён',
  cancelled: 'Отменён',
};

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  not_started: 'Не начат',
  in_progress: 'В работе',
  ready: 'Готов',
  in_review: 'На приёмке',
  accepted: 'Принят',
  overdue: 'Просрочен',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Не начата',
  in_progress: 'В работе',
  done: 'Завершена',
  blocked: 'Заблокирована',
};

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  planned: 'Запланирован',
  active: 'Активен',
  done: 'Завершён',
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  charter: 'Устав',
  project: 'Проект',
  plan: 'План',
  tz: 'ТЗ',
  kp: 'КП',
  report: 'Отчёт',
  protocol: 'Протокол',
  regulation: 'Регламент',
  other: 'Другое',
};

export const HEALTH_LABELS: Record<Health, string> = {
  ok: 'В норме',
  warn: 'Внимание',
  risk: 'Риск',
};

export const HEALTH_DOT: Record<Health, string> = { ok: '🟢', warn: '🟡', risk: '🔴' };
