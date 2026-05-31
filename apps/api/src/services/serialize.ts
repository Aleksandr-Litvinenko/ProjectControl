import type { AuthUser } from '../middleware/auth';

/**
 * Урезанная сериализация для роли `client`:
 *  - без загрузки специалистов (allocations);
 *  - без внутренних заметок (internalNote) в пунктах чек-листа.
 */
export function serializeProjectForUser<T extends Record<string, any>>(project: T, user: AuthUser): T {
  if (user.role !== 'client') return project;
  const clone: any = { ...project };
  clone.allocations = [];
  if (Array.isArray(clone.checklist)) {
    clone.checklist = clone.checklist.map((c: any) => {
      const { internalNote, ...rest } = c;
      return rest;
    });
  }
  return clone;
}
