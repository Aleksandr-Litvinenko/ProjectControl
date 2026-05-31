import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../env';

export const COOKIE_NAME = 'pc_session';

export interface SessionPayload {
  uid: string;
  role: Role;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.sessionSecret, { expiresIn: `${env.sessionTtlDays}d` });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, env.sessionSecret) as SessionPayload;
  } catch {
    return null;
  }
}
