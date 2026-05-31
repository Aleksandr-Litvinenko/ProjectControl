import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler, HttpError } from '../http';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// Список типов проектов — для фильтров и форм
router.get(
  '/project-types',
  asyncHandler(async (_req, res) => {
    const types = await prisma.projectType.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
    res.json(types);
  }),
);

// Шаблон чек-листа по типу — для предпросмотра при создании проекта
router.get(
  '/project-types/:id/template',
  asyncHandler(async (req, res) => {
    const tpl = await prisma.checklistTemplate.findFirst({
      where: { projectTypeId: req.params.id },
      include: { items: { orderBy: { defaultOrder: 'asc' } } },
    });
    if (!tpl) throw new HttpError(404, 'Шаблон для типа не найден');
    res.json(tpl);
  }),
);

export default router;
