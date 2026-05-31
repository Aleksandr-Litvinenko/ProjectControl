import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { asyncHandler, HttpError } from '../../http';
import { writeAudit } from '../../services/audit';
import { zDocType } from '../../constants';

const router = Router();

const itemSchema = z.object({
  title: z.string().min(1),
  docType: zDocType.default('other'),
  mandatory: z.boolean().default(false),
  requiresPmoApproval: z.boolean().default(false),
  stageHint: z.number().int().positive().nullable().optional(),
  defaultOrder: z.number().int().default(0),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const templates = await prisma.checklistTemplate.findMany({
      orderBy: { name: 'asc' },
      include: {
        projectType: { select: { id: true, name: true } },
        items: { orderBy: { defaultOrder: 'asc' } },
      },
    });
    res.json(templates);
  }),
);

const createSchema = z.object({
  projectTypeId: z.string().min(1),
  name: z.string().min(1),
  items: z.array(itemSchema).default([]),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    if (!(await prisma.projectType.findUnique({ where: { id: data.projectTypeId } }))) {
      throw new HttpError(400, 'Тип проекта не найден');
    }
    const tpl = await prisma.checklistTemplate.create({
      data: {
        projectTypeId: data.projectTypeId,
        name: data.name,
        items: { create: data.items },
      },
      include: { items: true, projectType: { select: { id: true, name: true } } },
    });
    await writeAudit(req.user!.id, 'template_create', 'ChecklistTemplate', tpl.id, { name: tpl.name });
    res.status(201).json(tpl);
  }),
);

const updateSchema = z.object({
  name: z.string().min(1),
  items: z.array(itemSchema),
});

// Полная замена шаблона (имя + список пунктов)
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = updateSchema.parse(req.body);
    if (!(await prisma.checklistTemplate.findUnique({ where: { id } }))) throw new HttpError(404, 'Шаблон не найден');
    await prisma.$transaction([
      prisma.checklistTemplateItem.deleteMany({ where: { templateId: id } }),
      prisma.checklistTemplate.update({ where: { id }, data: { name: data.name } }),
      prisma.checklistTemplateItem.createMany({
        data: data.items.map((it) => ({ ...it, templateId: id, stageHint: it.stageHint ?? null })),
      }),
    ]);
    const tpl = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { defaultOrder: 'asc' } }, projectType: { select: { id: true, name: true } } },
    });
    await writeAudit(req.user!.id, 'template_update', 'ChecklistTemplate', id, { items: data.items.length });
    res.json(tpl);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    await prisma.checklistTemplate.delete({ where: { id } });
    await writeAudit(req.user!.id, 'template_delete', 'ChecklistTemplate', id);
    res.json({ ok: true });
  }),
);

export default router;
