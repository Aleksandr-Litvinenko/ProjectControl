import { z } from 'zod';

export const ROLES = ['pmo_admin', 'pm', 'specialist', 'observer', 'client'] as const;
export const ACCESS_ROLES = ['pm', 'specialist', 'observer', 'client'] as const;
export const DOC_TYPES = ['charter', 'project', 'plan', 'tz', 'kp', 'report', 'protocol', 'regulation', 'other'] as const;
export const PROJECT_STATUSES = ['planned', 'active', 'on_hold', 'done', 'cancelled'] as const;
export const STAGE_STATUSES = ['planned', 'active', 'done'] as const;
export const TASK_STATUSES = ['not_started', 'in_progress', 'done', 'blocked'] as const;
export const CHECKLIST_STATUSES = ['not_started', 'in_progress', 'ready', 'in_review', 'accepted', 'overdue'] as const;

export const zRole = z.enum(ROLES);
export const zAccessRole = z.enum(ACCESS_ROLES);
export const zDocType = z.enum(DOC_TYPES);
export const zProjectStatus = z.enum(PROJECT_STATUSES);
export const zStageStatus = z.enum(STAGE_STATUSES);
export const zTaskStatus = z.enum(TASK_STATUSES);

/** Пустую строку/он null превращаем в undefined для опциональных полей. */
export const optionalString = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional(),
);

/** ISO-строку даты → Date (или undefined). */
export const zDateOptional = z.preprocess((v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
}, z.date().optional());
