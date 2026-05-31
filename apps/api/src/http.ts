import type { Request, Response, NextFunction } from 'express';

/** Ошибка с HTTP-статусом — перехватывается общим error-handler. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Обёртка async-обработчиков: пробрасывает reject в next(). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
