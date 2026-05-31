import express from 'express';
import type { ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ZodError } from 'zod';
import { env } from './env';
import { HttpError } from './http';
import { attachUser } from './middleware/auth';
import authRouter from './routes/auth';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (!env.isProd) {
  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    }),
  );
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'projectcontrol-api', env: env.nodeEnv, time: new Date().toISOString() });
});

// Пользователь из сессии доступен дальше как req.user
app.use(attachUser);

app.use('/api/auth', authRouter);

// 404 для неизвестных /api маршрутов
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Не найдено' });
});

// Глобальный обработчик ошибок
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Ошибка валидации', details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
};
app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] слушает :${env.port} (${env.nodeEnv})`);
});
