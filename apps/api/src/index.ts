import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from './env';

const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// В dev фронт работает на :5173 — разрешаем CORS с credentials.
if (!env.isProd) {
  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    }),
  );
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'projectcontrol-api',
    env: env.nodeEnv,
    time: new Date().toISOString(),
  });
});

// 404 для неизвестных /api маршрутов
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Не найдено' });
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] слушает :${env.port} (${env.nodeEnv})`);
});
