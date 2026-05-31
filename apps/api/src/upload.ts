import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { env } from './env';
import { HttpError } from './http';

const MAX_BYTES = env.maxUploadMb * 1024 * 1024;

// Белый список расширений (по ТЗ): docx, pdf, xlsx, png, jpg/jpeg, zip
const ALLOWED_EXT = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg', 'zip'];

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (ALLOWED_EXT.includes(ext)) cb(null, true);
    else cb(new Error(`Недопустимый тип файла. Разрешено: ${ALLOWED_EXT.join(', ')}`));
  },
});

/** Обёртка multer.single → 400 вместо 500 на ошибках загрузки. */
export function uploadSingle(field: string) {
  const mw = multerUpload.single(field);
  return (req: Request, res: Response, next: NextFunction): void => {
    mw(req, res, (err: unknown) => {
      if (err) {
        const e = err as { code?: string; message?: string };
        const msg =
          e.code === 'LIMIT_FILE_SIZE'
            ? `Файл больше ${env.maxUploadMb} МБ`
            : e.message || 'Ошибка загрузки файла';
        next(new HttpError(400, msg));
        return;
      }
      next();
    });
  };
}

/** Санитизация имени файла: только буквы/цифры/._- (включая кириллицу), без путей. */
export function safeFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, '');
  const cleaned = base.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 200);
  return cleaned || 'file';
}
