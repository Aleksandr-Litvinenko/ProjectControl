import 'dotenv/config';

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  port: num(process.env.API_PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me',
  sessionTtlDays: num(process.env.SESSION_TTL_DAYS, 7),
  cookieSecure: (process.env.COOKIE_SECURE ?? 'false') === 'true',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  storageDir: process.env.STORAGE_DIR ?? './storage',
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 25),
  publicDomain: process.env.PUBLIC_DOMAIN || undefined,
  health: {
    deadlineSoonDays: num(process.env.HEALTH_DEADLINE_SOON_DAYS, 7),
    overloadYellowPct: num(process.env.HEALTH_OVERLOAD_YELLOW_PCT, 100),
    overloadRedPct: num(process.env.HEALTH_OVERLOAD_RED_PCT, 120),
  },
} as const;
