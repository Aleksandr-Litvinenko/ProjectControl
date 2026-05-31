import { prisma } from '../db';
import type { AuthUser } from '../middleware/auth';
import { HttpError } from '../http';

/** 'ALL' для админа, иначе список id доступных проектов. */
export async function accessibleProjectIds(user: AuthUser): Promise<string[] | 'ALL'> {
  if (user.role === 'pmo_admin') return 'ALL';
  const rows = await prisma.projectAccess.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}

/** Where-фильтр Prisma по доступным проектам (для скоупинга выборок). */
export async function projectScopeWhere(user: AuthUser): Promise<Record<string, unknown>> {
  const ids = await accessibleProjectIds(user);
  if (ids === 'ALL') return {};
  return { id: { in: ids } };
}

export async function canAccessProject(user: AuthUser, projectId: string): Promise<boolean> {
  if (user.role === 'pmo_admin') return true;
  const a = await prisma.projectAccess.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  return !!a;
}

/** Право записи в проект: админ или назначенный РП этого проекта. */
export async function canWriteProject(user: AuthUser, projectId: string): Promise<boolean> {
  if (user.role === 'pmo_admin') return true;
  if (user.role !== 'pm') return false;
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { pmUserId: true },
  });
  return !!p && p.pmUserId === user.id;
}

export async function assertAccess(user: AuthUser, projectId: string): Promise<void> {
  if (!(await canAccessProject(user, projectId))) throw new HttpError(403, 'Нет доступа к проекту');
}

export async function assertWrite(user: AuthUser, projectId: string): Promise<void> {
  if (!(await canWriteProject(user, projectId))) throw new HttpError(403, 'Нет прав на изменение проекта');
}
