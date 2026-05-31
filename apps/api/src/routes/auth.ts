import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { verifyPassword, hashPassword } from '../auth/password';
import { signSession, COOKIE_NAME } from '../auth/tokens';
import { asyncHandler, HttpError } from '../http';
import { requireAuth } from '../middleware/auth';
import { env } from '../env';
import { writeAudit } from '../services/audit';

const router = Router();

function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    domain: env.cookieDomain,
    maxAge: env.sessionTtlDays * 86400 * 1000,
    path: '/',
  });
}

const loginSchema = z.object({
  login: z.string().min(1, 'Укажите логин'),
  password: z.string().min(1, 'Укажите пароль'),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { login, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { login } });
    if (!user || !user.isActive) throw new HttpError(401, 'Неверный логин или пароль');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Неверный логин или пароль');

    const token = signSession({ uid: user.id, role: user.role });
    setSessionCookie(res, token);
    await writeAudit(user.id, 'login', 'User', user.id);
    res.json({ id: user.id, fullName: user.fullName, login: user.login, role: user.role });
  }),
);

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/', domain: env.cookieDomain });
  void writeAudit(req.user?.id, 'logout', 'User', req.user?.id);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'Минимум 6 символов'),
});

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePwSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(404, 'Пользователь не найден');
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new HttpError(400, 'Текущий пароль неверен');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await writeAudit(user.id, 'change_password', 'User', user.id);
    res.json({ ok: true });
  }),
);

export default router;
