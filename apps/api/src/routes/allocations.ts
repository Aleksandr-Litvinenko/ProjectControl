import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler, HttpError } from '../http';
import { requireAuth } from '../middleware/auth';
import { assertWrite } from '../services/access';
import { accessibleProjectIds } from '../services/access';
import { writeAudit } from '../services/audit';
import { currentWeek, occupancyByUser } from '../services/metrics';
import { env } from '../env';
import dayjs from 'dayjs';

const router = Router();
router.use(requireAuth);

const allocSchema = z.object({
  userId: z.string().min(1, 'Выберите специалиста'),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  hoursPerDay: z.coerce.number().min(0).max(24).default(0),
  occupancyPercent: z.coerce.number().int().min(0).max(500).default(0),
});

// Создать аллокацию (РП/админ)
router.post(
  '/:id/allocations',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const d = allocSchema.parse(req.body);
    if (dayjs(d.periodEnd).isBefore(d.periodStart)) throw new HttpError(400, 'Конец периода раньше начала');
    if (!(await prisma.user.findUnique({ where: { id: d.userId } }))) throw new HttpError(400, 'Специалист не найден');
    const a = await prisma.allocation.create({ data: { projectId: req.params.id, ...d } });
    await writeAudit(req.user!.id, 'allocation_create', 'Allocation', a.id, { userId: d.userId });
    res.status(201).json(a);
  }),
);

router.patch(
  '/:id/allocations/:allocId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const a = await prisma.allocation.findUnique({ where: { id: req.params.allocId } });
    if (!a || a.projectId !== req.params.id) throw new HttpError(404, 'Загрузка не найдена');
    const d = allocSchema.partial().parse(req.body);
    const updated = await prisma.allocation.update({ where: { id: a.id }, data: d });
    await writeAudit(req.user!.id, 'allocation_update', 'Allocation', a.id, d);
    res.json(updated);
  }),
);

router.delete(
  '/:id/allocations/:allocId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const a = await prisma.allocation.findUnique({ where: { id: req.params.allocId } });
    if (!a || a.projectId !== req.params.id) throw new HttpError(404, 'Загрузка не найдена');
    await prisma.allocation.delete({ where: { id: a.id } });
    await writeAudit(req.user!.id, 'allocation_delete', 'Allocation', a.id);
    res.json({ ok: true });
  }),
);

export default router;

// ───────────── Сводный экран загрузки (через проекты) ─────────────
export const allocationsSummaryRouter = Router();
allocationsSummaryRouter.use(requireAuth);

allocationsSummaryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const scope = await accessibleProjectIds(user);

    // Окно: 4 недели от начала текущей ISO-недели (по умолчанию)
    const weeks = Math.min(Math.max(Number(req.query.weeks) || 4, 1), 12);
    const base = currentWeek();
    const windowStart = dayjs(base.start);
    const buckets = Array.from({ length: weeks }, (_, i) => ({
      start: windowStart.add(i, 'week').startOf('isoWeek'),
      end: windowStart.add(i, 'week').endOf('isoWeek'),
    }));

    const where: Record<string, unknown> = {};
    if (scope !== 'ALL') where.projectId = { in: scope };
    // Специалист видит только свою загрузку
    if (user.role === 'specialist') where.userId = user.id;

    const allocations = await prisma.allocation.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true } },
        project: { select: { id: true, title: true } },
      },
    });

    // Сгруппировать по специалисту × неделя
    const users = new Map<string, { id: string; fullName: string }>();
    for (const a of allocations) users.set(a.userId, a.user);

    const redPct = env.health.overloadRedPct;
    const yellowPct = env.health.overloadYellowPct;

    const rows = [...users.values()].map((u) => {
      const cells = buckets.map((b) => {
        const occ = occupancyByUser(
          allocations.filter((a) => a.userId === u.id),
          b.start.toDate(),
          b.end.toDate(),
        ).get(u.id) ?? 0;
        const level = occ > redPct ? 'risk' : occ > yellowPct ? 'warn' : 'ok';
        return { weekStart: b.start.format('YYYY-MM-DD'), occupancyPercent: occ, level };
      });
      const maxOcc = Math.max(0, ...cells.map((c) => c.occupancyPercent));
      return { user: u, cells, maxOccupancy: maxOcc, overloaded: maxOcc > yellowPct };
    });

    rows.sort((a, b) => b.maxOccupancy - a.maxOccupancy);
    res.json({
      weeks: buckets.map((b) => b.start.format('YYYY-MM-DD')),
      thresholds: { yellow: yellowPct, red: redPct },
      rows,
    });
  }),
);
