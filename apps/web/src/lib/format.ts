import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

export const fmtDate = (d: string | Date | null | undefined): string =>
  d ? dayjs(d).format('DD.MM.YYYY') : '—';

export const fmtDateTime = (d: string | Date | null | undefined): string =>
  d ? dayjs(d).format('DD.MM.YYYY HH:mm') : '—';

export const fmtBytes = (b: number): string => {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} КБ`;
  return `${(b / 1024 / 1024).toFixed(1)} МБ`;
};

export { dayjs };
