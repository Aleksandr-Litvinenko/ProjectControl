/** Клиентский расчёт метрик для шапки проекта (зеркало серверной логики, для мгновенного отображения). */
import type { ProjectDetail, Health } from '../../lib/types';
import { dayjs } from '../../lib/format';

export function computeMetrics(p: ProjectDetail) {
  const accepted = (s: string) => s === 'accepted';
  const now = dayjs();

  // прогресс
  let progress = 0;
  if (p.tasks.length) progress = Math.round(p.tasks.reduce((a, t) => a + t.progressPercent, 0) / p.tasks.length);
  else {
    const mand = p.checklist.filter((c) => c.mandatory);
    progress = mand.length ? Math.round((mand.filter((c) => accepted(c.status)).length / mand.length) * 100) : 0;
  }

  // документация
  const all = p.checklist;
  const mand = all.filter((c) => c.mandatory);
  const doc = {
    acceptedAll: all.filter((c) => accepted(c.status)).length,
    totalAll: all.length,
    acceptedMand: mand.filter((c) => accepted(c.status)).length,
    totalMand: mand.length,
  };

  // прогноз
  let forecast = { actualPercent: progress, expectedPercent: 0, deltaDays: 0, behind: false };
  if (p.startDate && p.plannedEndDate) {
    const start = dayjs(p.startDate), end = dayjs(p.plannedEndDate);
    const total = Math.max(1, end.diff(start, 'day'));
    const elapsed = Math.min(Math.max(now.diff(start, 'day'), 0), total);
    const expected = Math.round((elapsed / total) * 100);
    const deltaDays = Math.round(((progress - expected) / 100) * total);
    forecast = { actualPercent: progress, expectedPercent: expected, deltaDays, behind: deltaDays < 0 };
  }

  // здоровье
  const finished = p.status === 'done' || p.status === 'cancelled';
  const overdueMand = all.some((c) => c.mandatory && c.deadline && !accepted(c.status) && dayjs(c.deadline).isBefore(now));
  const planOverrun = !finished && !!p.plannedEndDate && dayjs(p.plannedEndDate).isBefore(now);
  const totals = new Map<string, number>();
  for (const a of p.allocations) totals.set(a.userId, (totals.get(a.userId) ?? 0) + a.occupancyPercent);
  const overloadRed = [...totals.values()].some((v) => v > 120);

  let health: Health = 'ok';
  if (overdueMand || planOverrun || overloadRed) health = 'risk';
  else if (!finished) {
    const soon = now.add(7, 'day');
    const deadlineSoon = all.some((c) => c.mandatory && !accepted(c.status) && c.deadline && dayjs(c.deadline).isAfter(now) && dayjs(c.deadline).isBefore(soon));
    if (deadlineSoon || forecast.behind) health = 'warn';
  }

  return { progress, doc, forecast, health };
}
