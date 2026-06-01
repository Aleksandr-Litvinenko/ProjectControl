import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../http';
import { requireRole } from '../middleware/auth';

const router = Router();
// Аудит-лог — только pmo_admin
router.use(requireRole('pmo_admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where: Record<string, unknown> = {};
    if (req.query.userId) where.userId = String(req.query.userId);
    if (req.query.entityType) where.entityType = String(req.query.entityType);

    const take = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { id: true, fullName: true, login: true } } },
    });
    res.json(logs);
  }),
);

export default router;
