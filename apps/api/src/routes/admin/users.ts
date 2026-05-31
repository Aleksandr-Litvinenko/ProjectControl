import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { asyncHandler, HttpError } from '../../http';
import { hashPassword } from '../../auth/password';
import { writeAudit } from '../../services/audit';
import { zRole } from '../../constants';

const router = Router();

const userSelect = {
  id: true,
  fullName: true,
  login: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

const emailField = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().email('Некорректный email').optional(),
);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
      select: { ...userSelect, _count: { select: { access: true, managedProjects: true } } },
    });
    res.json(users);
  }),
);

const createSchema = z.object({
  fullName: z.string().min(1, 'Укажите ФИО'),
  login: z.string().min(2).regex(/^[a-zA-Z0-9_.-]+$/, 'Логин: латиница, цифры, . _ -'),
  email: emailField,
  role: zRole,
  password: z.string().min(6, 'Минимум 6 символов'),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    if (await prisma.user.findUnique({ where: { login: data.login } })) {
      throw new HttpError(409, 'Логин уже занят');
    }
    if (data.email && (await prisma.user.findUnique({ where: { email: data.email } }))) {
      throw new HttpError(409, 'Email уже занят');
    }
    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        login: data.login,
        email: data.email,
        role: data.role,
        passwordHash: await hashPassword(data.password),
      },
      select: userSelect,
    });
    await writeAudit(req.user!.id, 'user_create', 'User', user.id, { login: user.login, role: user.role });
    res.status(201).json(user);
  }),
);

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().email().nullable().optional()),
  role: zRole.optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = updateSchema.parse(req.body);
    if (!(await prisma.user.findUnique({ where: { id } }))) throw new HttpError(404, 'Пользователь не найден');
    if (id === req.user!.id && data.isActive === false) {
      throw new HttpError(400, 'Нельзя деактивировать самого себя');
    }
    const user = await prisma.user.update({ where: { id }, data, select: userSelect });
    await writeAudit(req.user!.id, 'user_update', 'User', id, data);
    res.json(user);
  }),
);

const resetSchema = z.object({ newPassword: z.string().min(6, 'Минимум 6 символов') });

router.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { newPassword } = resetSchema.parse(req.body);
    if (!(await prisma.user.findUnique({ where: { id } }))) throw new HttpError(404, 'Пользователь не найден');
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(newPassword) } });
    await writeAudit(req.user!.id, 'user_reset_password', 'User', id);
    res.json({ ok: true });
  }),
);

export default router;
