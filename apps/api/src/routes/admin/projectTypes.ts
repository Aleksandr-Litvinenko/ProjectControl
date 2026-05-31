import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { asyncHandler, HttpError } from '../../http';
import { writeAudit } from '../../services/audit';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const types = await prisma.projectType.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { projects: true, templates: true } } },
    });
    res.json(types);
  }),
);

const typeSchema = z.object({
  name: z.string().min(1, 'Укажите название'),
  description: z.preprocess((v) => (v === '' ? null : v), z.string().nullable().optional()),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = typeSchema.parse(req.body);
    if (await prisma.projectType.findUnique({ where: { name: data.name } })) {
      throw new HttpError(409, 'Тип с таким названием уже есть');
    }
    const type = await prisma.projectType.create({ data: { name: data.name, description: data.description ?? null } });
    await writeAudit(req.user!.id, 'type_create', 'ProjectType', type.id, { name: type.name });
    res.status(201).json(type);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = typeSchema.partial().parse(req.body);
    if (!(await prisma.projectType.findUnique({ where: { id } }))) throw new HttpError(404, 'Тип не найден');
    const type = await prisma.projectType.update({ where: { id }, data });
    await writeAudit(req.user!.id, 'type_update', 'ProjectType', id, data);
    res.json(type);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const count = await prisma.project.count({ where: { projectTypeId: id } });
    if (count > 0) throw new HttpError(409, `Нельзя удалить: есть проекты этого типа (${count})`);
    await prisma.projectType.delete({ where: { id } });
    await writeAudit(req.user!.id, 'type_delete', 'ProjectType', id);
    res.json({ ok: true });
  }),
);

export default router;
