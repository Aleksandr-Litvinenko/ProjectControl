import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../db';
import { verifySession, COOKIE_NAME } from '../auth/tokens';
import { HttpError } from '../http';

export interface AuthUser {
  id: string;
  role: Role;
  fullName: string;
  login: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Достаёт пользователя из cookie-сессии (не требует входа). */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      const payload = verifySession(token);
      if (payload) {
        const u = await prisma.user.findUnique({ where: { id: payload.uid } });
        if (u && u.isActive) {
          req.user = { id: u.id, role: u.role, fullName: u.fullName, login: u.login };
        }
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new HttpError(401, 'Требуется вход');
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new HttpError(401, 'Требуется вход');
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'Недостаточно прав');
    next();
  };
}
