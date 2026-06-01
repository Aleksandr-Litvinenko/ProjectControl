import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler, HttpError } from '../http';
import { requireAuth } from '../middleware/auth';
import { assertWrite, canWriteProject } from '../services/access';
import { writeAudit } from '../services/audit';
import { zTaskStatus, zDateOptional, optionalString } from '../constants';

const router = Router();
router.use(requireAuth);

async function getTaskInProject(taskId: string, projectId: string) {
  const t = await prisma.task.findUnique({ where: { id: taskId } });
  if (!t || t.projectId !== projectId) throw new HttpError(404, 'Задача не найдена');
  return t;
}

const nullableId = z.preprocess((v) => (v === '' ? null : v), z.string().nullable().optional());
const progress = z.number().int().min(0).max(100);

// ───────────────────────── Задачи ─────────────────────────
const createTask = z.object({
  title: z.string().min(1),
  stageId: optionalString,
  assigneeUserId: optionalString,
  startDate: zDateOptional,
  endDate: zDateOptional,
  progressPercent: progress.default(0),
  status: zTaskStatus.default('not_started'),
});

router.post(
  '/:id/tasks',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const d = createTask.parse(req.body);
    const task = await prisma.task.create({ data: { projectId: req.params.id, ...d } });
    await writeAudit(req.user!.id, 'task_create', 'Task', task.id, { title: task.title });
    res.status(201).json(task);
  }),
);

const updateTask = z.object({
  title: z.string().min(1).optional(),
  stageId: nullableId,
  assigneeUserId: nullableId,
  startDate: zDateOptional,
  endDate: zDateOptional,
  progressPercent: progress.optional(),
  status: zTaskStatus.optional(),
});

router.patch(
  '/:id/tasks/:taskId',
  asyncHandler(async (req, res) => {
    const task = await getTaskInProject(req.params.taskId, req.params.id);
    const canWrite = await canWriteProject(req.user!, req.params.id);
    // Специалист может менять прогресс/статус только своей задачи
    const isOwnAssignee = task.assigneeUserId === req.user!.id;
    if (!canWrite && !isOwnAssignee) throw new HttpError(403, 'Нет прав на изменение задачи');

    let d = updateTask.parse(req.body);
    if (!canWrite) {
      // не-РП (специалист-исполнитель) — только прогресс и статус
      d = { progressPercent: d.progressPercent, status: d.status };
    }
    const updated = await prisma.task.update({ where: { id: task.id }, data: d });
    await writeAudit(req.user!.id, 'task_update', 'Task', task.id, d);
    res.json(updated);
  }),
);

router.delete(
  '/:id/tasks/:taskId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    await getTaskInProject(req.params.taskId, req.params.id);
    await prisma.task.delete({ where: { id: req.params.taskId } });
    await writeAudit(req.user!.id, 'task_delete', 'Task', req.params.taskId);
    res.json({ ok: true });
  }),
);

// ───────────────────────── Вехи ─────────────────────────
const createMs = z.object({
  title: z.string().min(1),
  date: zDateOptional,
  reached: z.boolean().default(false),
});

router.post(
  '/:id/milestones',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const d = createMs.parse(req.body);
    if (!d.date) throw new HttpError(400, 'Укажите дату вехи');
    const ms = await prisma.milestone.create({ data: { projectId: req.params.id, title: d.title, date: d.date, reached: d.reached } });
    await writeAudit(req.user!.id, 'milestone_create', 'Milestone', ms.id, { title: ms.title });
    res.status(201).json(ms);
  }),
);

const updateMs = z.object({
  title: z.string().min(1).optional(),
  date: zDateOptional,
  reached: z.boolean().optional(),
});

router.patch(
  '/:id/milestones/:msId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const ms = await prisma.milestone.findUnique({ where: { id: req.params.msId } });
    if (!ms || ms.projectId !== req.params.id) throw new HttpError(404, 'Веха не найдена');
    const d = updateMs.parse(req.body);
    const updated = await prisma.milestone.update({ where: { id: ms.id }, data: d });
    await writeAudit(req.user!.id, 'milestone_update', 'Milestone', ms.id, d);
    res.json(updated);
  }),
);

router.delete(
  '/:id/milestones/:msId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const ms = await prisma.milestone.findUnique({ where: { id: req.params.msId } });
    if (!ms || ms.projectId !== req.params.id) throw new HttpError(404, 'Веха не найдена');
    await prisma.milestone.delete({ where: { id: ms.id } });
    await writeAudit(req.user!.id, 'milestone_delete', 'Milestone', ms.id);
    res.json({ ok: true });
  }),
);

export default router;
