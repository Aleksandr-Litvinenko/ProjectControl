import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../http';
import { requireAuth } from '../middleware/auth';
import { accessibleProjectIds } from '../services/access';
import {
  projectMetrics, currentWeek, occupancyByUser, isOverdue, type AllocationLike,
} from '../services/metrics';
import { env } from '../env';
import type { AuthUser } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const projectInclude = {
  projectType: { select: { id: true, name: true } },
  pm: { select: { id: true, fullName: true } },
  checklist: { select: { mandatory: true, status: true, deadline: true, stageId: true } },
  tasks: { select: { progressPercent: true } },
  stages: { select: { id: true, status: true } },
  allocations: { select: { userId: true, periodStart: true, periodEnd: true, occupancyPercent: true } },
} as const;

async function scopedWhere(user: AuthUser): Promise<Record<string, unknown>> {
  const ids = await accessibleProjectIds(user);
  return ids === 'ALL' ? {} : { id: { in: ids } };
}

function applyFilters(where: Record<string, any>, q: Record<string, unknown>): void {
  if (q.status) where.status = String(q.status);
  if (q.projectTypeId) where.projectTypeId = String(q.projectTypeId);
  if (q.pmUserId) where.pmUserId = String(q.pmUserId);
  if (q.client) where.client = { contains: String(q.client), mode: 'insensitive' };
}

export interface DashboardRow {
  id: string; title: string; client: string;
  projectType: { id: string; name: string } | null;
  pm: { id: string; fullName: string } | null;
  status: string;
  startDate: Date | null; plannedEndDate: Date | null; actualEndDate: Date | null;
  progress: number; health: string;
  doc: ReturnType<typeof projectMetrics>['doc'];
  forecast: ReturnType<typeof projectMetrics>['forecast'];
  overdueMandatoryCount: number;
}

export async function buildDashboard(user: AuthUser, q: Record<string, unknown>) {
  const where = await scopedWhere(user);
  applyFilters(where, q);

  const projects = await prisma.project.findMany({ where, include: projectInclude, orderBy: { createdAt: 'desc' } });

  const rows: DashboardRow[] = projects.map((p) => {
    const m = projectMetrics(p as any);
    return {
      id: p.id, title: p.title, client: p.client,
      projectType: p.projectType, pm: p.pm, status: p.status,
      startDate: p.startDate, plannedEndDate: p.plannedEndDate, actualEndDate: p.actualEndDate,
      progress: m.progress, health: m.health, doc: m.doc, forecast: m.forecast,
      overdueMandatoryCount: m.overdueMandatoryCount,
    };
  });

  // ── Перегруженные специалисты (в текущей неделе) по доступным проектам ──
  const projectIds = projects.map((p) => p.id);
  const allAllocs = projectIds.length
    ? await prisma.allocation.findMany({
        where: { projectId: { in: projectIds } },
        select: { userId: true, periodStart: true, periodEnd: true, occupancyPercent: true },
      })
    : [];
  const { start, end } = currentWeek();
  const occ = occupancyByUser(allAllocs as AllocationLike[], start, end);
  let overloadedSpecialists = 0;
  for (const v of occ.values()) if (v > env.health.overloadYellowPct) overloadedSpecialists++;

  // ── Сводные KPI ──
  const activeStatuses = new Set(['planned', 'active', 'on_hold']);
  const totalActive = rows.filter((r) => activeStatuses.has(r.status)).length;
  const totalAcceptedDocs = rows.reduce((a, r) => a + r.doc.acceptedAll, 0);
  const totalDocs = rows.reduce((a, r) => a + r.doc.totalAll, 0);
  const atRisk = rows.filter((r) => r.health === 'risk' || r.health === 'warn').length;
  const overdueItems = projects.reduce(
    (a, p) => a + p.checklist.filter((c) => isOverdue(c as any)).length,
    0,
  );

  const summary = {
    totalProjects: rows.length,
    activeProjects: totalActive,
    docFillPortfolio: totalDocs ? Math.round((totalAcceptedDocs / totalDocs) * 100) : 0,
    projectsAtRisk: atRisk,
    riskRed: rows.filter((r) => r.health === 'risk').length,
    riskYellow: rows.filter((r) => r.health === 'warn').length,
    overdueChecklistItems: overdueItems,
    overloadedSpecialists,
  };

  return { summary, rows };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await buildDashboard(req.user!, req.query as Record<string, unknown>));
  }),
);

export default router;
