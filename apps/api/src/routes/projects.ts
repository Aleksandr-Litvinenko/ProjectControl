import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler, HttpError } from '../http';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertAccess, assertWrite, projectScopeWhere } from '../services/access';
import { serializeProjectForUser } from '../services/serialize';
import { writeAudit } from '../services/audit';
import { zProjectStatus, zStageStatus, zAccessRole, zDateOptional, optionalString } from '../constants';

const router = Router();
router.use(requireAuth);

// ───────────────────────── Список (скоуп по доступу) ─────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = await projectScopeWhere(req.user!);
    const where: Record<string, any> = { ...scope };
    const { status, projectTypeId, pmUserId, client } = req.query;
    if (status) where.status = String(status);
    if (projectTypeId) where.projectTypeId = String(projectTypeId);
    if (pmUserId) where.pmUserId = String(pmUserId);
    if (client) where.client = { contains: String(client), mode: 'insensitive' };
    const fromQ = req.query.from ? new Date(String(req.query.from)) : undefined;
    const toQ = req.query.to ? new Date(String(req.query.to)) : undefined;
    if (fromQ && !Number.isNaN(fromQ.getTime())) where.plannedEndDate = { gte: fromQ };
    if (toQ && !Number.isNaN(toQ.getTime())) where.startDate = { lte: toQ };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        projectType: { select: { id: true, name: true } },
        pm: { select: { id: true, fullName: true } },
        _count: { select: { checklist: true, tasks: true, stages: true } },
      },
    });
    res.json(projects);
  }),
);

// ───────────────────────── Создание (только админ) ─────────────────────────
const createSchema = z.object({
  title: z.string().min(1, 'Укажите название'),
  client: z.string().min(1, 'Укажите заказчика'),
  projectTypeId: z.string().min(1, 'Выберите тип'),
  description: optionalString,
  status: zProjectStatus.default('planned'),
  startDate: zDateOptional,
  plannedEndDate: zDateOptional,
  pmUserId: optionalString,
});

router.post(
  '/',
  requireRole('pmo_admin'),
  asyncHandler(async (req, res) => {
    const d = createSchema.parse(req.body);
    if (!(await prisma.projectType.findUnique({ where: { id: d.projectTypeId } }))) {
      throw new HttpError(400, 'Тип проекта не найден');
    }
    if (d.pmUserId && !(await prisma.user.findUnique({ where: { id: d.pmUserId } }))) {
      throw new HttpError(400, 'Руководитель проекта не найден');
    }

    const project = await prisma.project.create({
      data: {
        title: d.title,
        client: d.client,
        projectTypeId: d.projectTypeId,
        description: d.description,
        status: d.status,
        startDate: d.startDate,
        plannedEndDate: d.plannedEndDate,
        createdById: req.user!.id,
        pmUserId: d.pmUserId,
      },
    });

    // Инстанцируем чек-лист из шаблона типа
    const tpl = await prisma.checklistTemplate.findFirst({
      where: { projectTypeId: d.projectTypeId },
      include: { items: { orderBy: { defaultOrder: 'asc' } } },
    });
    if (tpl && tpl.items.length) {
      await prisma.checklistItem.createMany({
        data: tpl.items.map((it) => ({
          projectId: project.id,
          title: it.title,
          docType: it.docType,
          mandatory: it.mandatory,
          requiresPmoApproval: it.requiresPmoApproval,
          order: it.defaultOrder,
          status: 'not_started' as const,
        })),
      });
    }

    // Доступ РП
    if (d.pmUserId) {
      await prisma.projectAccess.upsert({
        where: { projectId_userId: { projectId: project.id, userId: d.pmUserId } },
        update: { accessRole: 'pm' },
        create: { projectId: project.id, userId: d.pmUserId, accessRole: 'pm' },
      });
    }

    await writeAudit(req.user!.id, 'project_create', 'Project', project.id, { title: project.title });
    res.status(201).json(project);
  }),
);

// ───────────────────────── Детали проекта ─────────────────────────
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertAccess(req.user!, req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        projectType: { select: { id: true, name: true } },
        pm: { select: { id: true, fullName: true, login: true } },
        createdBy: { select: { id: true, fullName: true } },
        stages: { orderBy: { order: 'asc' } },
        checklist: {
          orderBy: [{ order: 'asc' }],
          include: {
            responsible: { select: { id: true, fullName: true } },
            acceptedBy: { select: { id: true, fullName: true } },
            documents: { orderBy: { version: 'desc' }, include: { uploadedBy: { select: { id: true, fullName: true } } } },
          },
        },
        tasks: { orderBy: [{ startDate: 'asc' }], include: { assignee: { select: { id: true, fullName: true } } } },
        milestones: { orderBy: { date: 'asc' } },
        allocations: { include: { user: { select: { id: true, fullName: true } } } },
        access: { include: { user: { select: { id: true, fullName: true, login: true, role: true } } } },
      },
    });
    if (!project) throw new HttpError(404, 'Проект не найден');
    res.json(serializeProjectForUser(project, req.user!));
  }),
);

// ───────────────────────── Обновление (админ или РП проекта) ─────────────────────────
const updateSchema = z.object({
  title: z.string().min(1).optional(),
  client: z.string().min(1).optional(),
  description: optionalString,
  status: zProjectStatus.optional(),
  startDate: zDateOptional,
  plannedEndDate: zDateOptional,
  actualEndDate: zDateOptional,
  pmUserId: optionalString,
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const d = updateSchema.parse(req.body);
    const data: Record<string, any> = { ...d };
    // Сменить РП может только админ
    if (data.pmUserId !== undefined && req.user!.role !== 'pmo_admin') delete data.pmUserId;

    const project = await prisma.project.update({ where: { id: req.params.id }, data });

    if (data.pmUserId) {
      await prisma.projectAccess.upsert({
        where: { projectId_userId: { projectId: project.id, userId: data.pmUserId } },
        update: { accessRole: 'pm' },
        create: { projectId: project.id, userId: data.pmUserId, accessRole: 'pm' },
      });
    }
    await writeAudit(req.user!.id, 'project_update', 'Project', project.id, d);
    res.json(project);
  }),
);

router.delete(
  '/:id',
  requireRole('pmo_admin'),
  asyncHandler(async (req, res) => {
    await prisma.project.delete({ where: { id: req.params.id } });
    await writeAudit(req.user!.id, 'project_delete', 'Project', req.params.id);
    res.json({ ok: true });
  }),
);

// ───────────────────────── Доступы к проекту ─────────────────────────
router.get(
  '/:id/access',
  asyncHandler(async (req, res) => {
    await assertAccess(req.user!, req.params.id);
    const rows = await prisma.projectAccess.findMany({
      where: { projectId: req.params.id },
      include: { user: { select: { id: true, fullName: true, login: true, role: true } } },
    });
    res.json(rows);
  }),
);

const accessSchema = z.object({ userId: z.string().min(1), accessRole: zAccessRole });

router.post(
  '/:id/access',
  requireRole('pmo_admin'),
  asyncHandler(async (req, res) => {
    const d = accessSchema.parse(req.body);
    if (!(await prisma.project.findUnique({ where: { id: req.params.id } }))) throw new HttpError(404, 'Проект не найден');
    if (!(await prisma.user.findUnique({ where: { id: d.userId } }))) throw new HttpError(400, 'Пользователь не найден');
    const row = await prisma.projectAccess.upsert({
      where: { projectId_userId: { projectId: req.params.id, userId: d.userId } },
      update: { accessRole: d.accessRole },
      create: { projectId: req.params.id, userId: d.userId, accessRole: d.accessRole },
      include: { user: { select: { id: true, fullName: true, login: true, role: true } } },
    });
    await writeAudit(req.user!.id, 'access_grant', 'ProjectAccess', row.id, { projectId: req.params.id, userId: d.userId, accessRole: d.accessRole });
    res.status(201).json(row);
  }),
);

router.delete(
  '/:id/access/:userId',
  requireRole('pmo_admin'),
  asyncHandler(async (req, res) => {
    await prisma.projectAccess.deleteMany({ where: { projectId: req.params.id, userId: req.params.userId } });
    await writeAudit(req.user!.id, 'access_revoke', 'ProjectAccess', null, { projectId: req.params.id, userId: req.params.userId });
    res.json({ ok: true });
  }),
);

// ───────────────────────── Этапы (админ или РП проекта) ─────────────────────────
const stageSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().default(0),
  startDate: zDateOptional,
  endDate: zDateOptional,
  status: zStageStatus.default('planned'),
});

router.post(
  '/:id/stages',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const d = stageSchema.parse(req.body);
    const stage = await prisma.stage.create({ data: { projectId: req.params.id, ...d } });
    await writeAudit(req.user!.id, 'stage_create', 'Stage', stage.id, { projectId: req.params.id });
    res.status(201).json(stage);
  }),
);

async function assertStageInProject(stageId: string, projectId: string): Promise<void> {
  const stage = await prisma.stage.findUnique({ where: { id: stageId }, select: { projectId: true } });
  if (!stage || stage.projectId !== projectId) throw new HttpError(404, 'Этап не найден');
}

router.patch(
  '/:id/stages/:stageId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    await assertStageInProject(req.params.stageId, req.params.id);
    const d = stageSchema.partial().parse(req.body);
    const stage = await prisma.stage.update({ where: { id: req.params.stageId }, data: d });
    await writeAudit(req.user!.id, 'stage_update', 'Stage', stage.id, d);
    res.json(stage);
  }),
);

router.delete(
  '/:id/stages/:stageId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    await assertStageInProject(req.params.stageId, req.params.id);
    await prisma.stage.delete({ where: { id: req.params.stageId } });
    await writeAudit(req.user!.id, 'stage_delete', 'Stage', req.params.stageId);
    res.json({ ok: true });
  }),
);

export default router;
