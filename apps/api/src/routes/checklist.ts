import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma } from '../db';
import { asyncHandler, HttpError } from '../http';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertAccess, assertWrite } from '../services/access';
import { writeAudit } from '../services/audit';
import { zDocType, zDateOptional, optionalString } from '../constants';
import { uploadSingle, safeFileName } from '../upload';
import { env } from '../env';

const router = Router();
router.use(requireAuth);

async function getItemInProject(itemId: string, projectId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.projectId !== projectId) throw new HttpError(404, 'Пункт чек-листа не найден');
  return item;
}

const nullableId = z.preprocess((v) => (v === '' ? null : v), z.string().nullable().optional());

// ───────────────────────── Пункты чек-листа ─────────────────────────
const createItem = z.object({
  title: z.string().min(1),
  docType: zDocType.default('other'),
  mandatory: z.boolean().default(false),
  stageId: optionalString,
  deadline: zDateOptional,
  responsibleUserId: optionalString,
  requiresPmoApproval: z.boolean().default(false),
  order: z.number().int().default(0),
});

router.post(
  '/:id/checklist',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const d = createItem.parse(req.body);
    const item = await prisma.checklistItem.create({ data: { projectId: req.params.id, ...d } });
    await writeAudit(req.user!.id, 'checklist_create', 'ChecklistItem', item.id, { title: item.title });
    res.status(201).json(item);
  }),
);

const updateItem = z.object({
  title: z.string().min(1).optional(),
  docType: zDocType.optional(),
  mandatory: z.boolean().optional(),
  stageId: nullableId,
  deadline: zDateOptional,
  responsibleUserId: nullableId,
  requiresPmoApproval: z.boolean().optional(),
  order: z.number().int().optional(),
  internalNote: z.preprocess((v) => (v === '' ? null : v), z.string().nullable().optional()),
  // Прямой сброс к простым статусам; ready/accept/reject — отдельными действиями
  status: z.enum(['not_started', 'in_progress']).optional(),
});

router.patch(
  '/:id/checklist/:itemId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    await getItemInProject(req.params.itemId, req.params.id);
    const d = updateItem.parse(req.body);
    const item = await prisma.checklistItem.update({ where: { id: req.params.itemId }, data: d });
    await writeAudit(req.user!.id, 'checklist_update', 'ChecklistItem', item.id, d);
    res.json(item);
  }),
);

router.delete(
  '/:id/checklist/:itemId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    await getItemInProject(req.params.itemId, req.params.id);
    await prisma.checklistItem.delete({ where: { id: req.params.itemId } });
    await writeAudit(req.user!.id, 'checklist_delete', 'ChecklistItem', req.params.itemId);
    res.json({ ok: true });
  }),
);

// ── Двухступенчатая приёмка ──
// РП ставит «Готов»: если требуется приёмка ПО → in_review, иначе сразу accepted.
router.post(
  '/:id/checklist/:itemId/ready',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const item = await getItemInProject(req.params.itemId, req.params.id);
    const data = item.requiresPmoApproval
      ? { status: 'in_review' as const }
      : { status: 'accepted' as const, acceptedById: req.user!.id, acceptedAt: new Date() };
    const updated = await prisma.checklistItem.update({ where: { id: item.id }, data });
    await writeAudit(
      req.user!.id,
      item.requiresPmoApproval ? 'checklist_submit_review' : 'checklist_accept',
      'ChecklistItem',
      item.id,
      { status: updated.status },
    );
    res.json(updated);
  }),
);

// ПО принимает (вторая ступень)
router.post(
  '/:id/checklist/:itemId/accept',
  requireRole('pmo_admin'),
  asyncHandler(async (req, res) => {
    const item = await getItemInProject(req.params.itemId, req.params.id);
    const updated = await prisma.checklistItem.update({
      where: { id: item.id },
      data: { status: 'accepted', acceptedById: req.user!.id, acceptedAt: new Date() },
    });
    await writeAudit(req.user!.id, 'checklist_pmo_accept', 'ChecklistItem', item.id);
    res.json(updated);
  }),
);

// ПО возвращает на доработку
router.post(
  '/:id/checklist/:itemId/reject',
  requireRole('pmo_admin'),
  asyncHandler(async (req, res) => {
    const item = await getItemInProject(req.params.itemId, req.params.id);
    const updated = await prisma.checklistItem.update({
      where: { id: item.id },
      data: { status: 'in_progress', acceptedById: null, acceptedAt: null },
    });
    await writeAudit(req.user!.id, 'checklist_reject', 'ChecklistItem', item.id, { comment: req.body?.comment });
    res.json(updated);
  }),
);

// ───────────────────────── Документы (версии) ─────────────────────────
const preAuthWrite = asyncHandler(async (req, _res, next) => {
  await assertWrite(req.user!, req.params.id);
  next!();
});

router.post(
  '/:id/checklist/:itemId/documents',
  preAuthWrite,
  uploadSingle('file'),
  asyncHandler(async (req, res) => {
    const item = await getItemInProject(req.params.itemId, req.params.id);
    if (!req.file) throw new HttpError(400, 'Файл не передан');

    const last = await prisma.document.findFirst({
      where: { checklistItemId: item.id },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;
    const safe = safeFileName(req.file.originalname);
    const dir = path.join(env.storageDir, 'projects', req.params.id, item.id);
    await fs.mkdir(dir, { recursive: true });
    const stored = path.join(dir, `${version}__${safe}`);
    await fs.writeFile(stored, req.file.buffer);

    const doc = await prisma.document.create({
      data: {
        checklistItemId: item.id,
        projectId: req.params.id,
        originalName: req.file.originalname,
        storedPath: stored,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        version,
        uploadedById: req.user!.id,
      },
      include: { uploadedBy: { select: { id: true, fullName: true } } },
    });
    await writeAudit(req.user!.id, 'document_upload', 'Document', doc.id, { itemId: item.id, version });
    res.status(201).json(doc);
  }),
);

router.get(
  '/:id/documents/:docId/download',
  asyncHandler(async (req, res) => {
    await assertAccess(req.user!, req.params.id);
    const doc = await prisma.document.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.projectId !== req.params.id) throw new HttpError(404, 'Файл не найден');
    try {
      await fs.access(doc.storedPath);
    } catch {
      throw new HttpError(410, 'Файл отсутствует на сервере');
    }
    res.download(doc.storedPath, doc.originalName);
  }),
);

router.delete(
  '/:id/documents/:docId',
  asyncHandler(async (req, res) => {
    await assertWrite(req.user!, req.params.id);
    const doc = await prisma.document.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.projectId !== req.params.id) throw new HttpError(404, 'Файл не найден');
    await prisma.document.delete({ where: { id: doc.id } });
    fs.unlink(doc.storedPath).catch(() => undefined);
    await writeAudit(req.user!.id, 'document_delete', 'Document', doc.id);
    res.json({ ok: true });
  }),
);

export default router;
