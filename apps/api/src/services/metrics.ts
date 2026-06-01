/**
 * Единые расчёты ProjectControl (см. ARCHITECTURE.md §4).
 * Прогресс, заполненность документации, прогноз, индикатор здоровья, перегруз.
 */
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { env } from '../env';

dayjs.extend(isoWeek);

export type Health = 'ok' | 'warn' | 'risk';

export interface ChecklistLike {
  mandatory: boolean;
  status: string;
  deadline: Date | string | null;
}
export interface TaskLike {
  progressPercent: number;
}
export interface AllocationLike {
  userId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  occupancyPercent: number;
}
export interface ProjectLike {
  status: string;
  startDate: Date | string | null;
  plannedEndDate: Date | string | null;
  stages?: { id: string; status: string }[];
  checklist: ChecklistLike[];
  tasks: TaskLike[];
  allocations?: AllocationLike[];
}

const now = (): Date => new Date();
const isAccepted = (s: string): boolean => s === 'accepted';

/** Пункт просрочен: дедлайн в прошлом и не принят. */
export function isOverdue(item: ChecklistLike, ref: Date = now()): boolean {
  if (!item.deadline || isAccepted(item.status)) return false;
  return dayjs(item.deadline).isBefore(ref);
}

/** Прогресс проекта: среднее по задачам, иначе доля принятых обязательных пунктов. */
export function projectProgress(p: ProjectLike): number {
  if (p.tasks.length > 0) {
    const sum = p.tasks.reduce((a, t) => a + (t.progressPercent || 0), 0);
    return Math.round(sum / p.tasks.length);
  }
  const mand = p.checklist.filter((c) => c.mandatory);
  if (mand.length === 0) return 0;
  const acc = mand.filter((c) => isAccepted(c.status)).length;
  return Math.round((acc / mand.length) * 100);
}

/** Заполненность документации: всего и по обязательным (accepted / всего). */
export function docFill(p: ProjectLike): {
  acceptedAll: number; totalAll: number; ratioAll: number;
  acceptedMand: number; totalMand: number; ratioMand: number;
} {
  const all = p.checklist;
  const mand = all.filter((c) => c.mandatory);
  const accAll = all.filter((c) => isAccepted(c.status)).length;
  const accMand = mand.filter((c) => isAccepted(c.status)).length;
  return {
    acceptedAll: accAll,
    totalAll: all.length,
    ratioAll: all.length ? accAll / all.length : 0,
    acceptedMand: accMand,
    totalMand: mand.length,
    ratioMand: mand.length ? accMand / mand.length : 0,
  };
}

/** Прогноз: ожидаемый % по доле срока и отклонение в днях (>0 опережение). */
export function forecast(p: ProjectLike): {
  elapsedRatio: number; expectedPercent: number; actualPercent: number; deltaDays: number; behind: boolean;
} {
  const actual = projectProgress(p);
  if (!p.startDate || !p.plannedEndDate) {
    return { elapsedRatio: 0, expectedPercent: 0, actualPercent: actual, deltaDays: 0, behind: false };
  }
  const start = dayjs(p.startDate);
  const end = dayjs(p.plannedEndDate);
  const totalDays = Math.max(1, end.diff(start, 'day'));
  const elapsed = Math.min(Math.max(dayjs(now()).diff(start, 'day'), 0), totalDays);
  const elapsedRatio = elapsed / totalDays;
  const expectedPercent = Math.round(elapsedRatio * 100);
  const deltaDays = Math.round(((actual - expectedPercent) / 100) * totalDays);
  return { elapsedRatio, expectedPercent, actualPercent: actual, deltaDays, behind: deltaDays < 0 };
}

/** Границы текущей ISO-недели [пн 00:00, вс 23:59:59]. */
export function currentWeek(ref: Date = now()): { start: Date; end: Date } {
  const d = dayjs(ref);
  return { start: d.startOf('isoWeek').toDate(), end: d.endOf('isoWeek').toDate() };
}

/** Пересекается ли период аллокации с [from,to]. */
function overlaps(a: AllocationLike, from: Date, to: Date): boolean {
  return dayjs(a.periodStart).isBefore(to) && dayjs(a.periodEnd).isAfter(from);
}

/**
 * Суммарная занятость по специалистам за интервал (по умолчанию — текущая неделя).
 * Возвращает map userId → суммарный occupancyPercent среди пересекающихся аллокаций.
 */
export function occupancyByUser(
  allocations: AllocationLike[],
  from: Date,
  to: Date,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of allocations) {
    if (!overlaps(a, from, to)) continue;
    m.set(a.userId, (m.get(a.userId) ?? 0) + (a.occupancyPercent || 0));
  }
  return m;
}

/** Есть ли в проекте перегруз > порога в текущей неделе. */
export function hasOverload(p: ProjectLike, thresholdPct: number, ref: Date = now()): boolean {
  if (!p.allocations || p.allocations.length === 0) return false;
  const { start, end } = currentWeek(ref);
  for (const occ of occupancyByUser(p.allocations, start, end).values()) {
    if (occ > thresholdPct) return true;
  }
  return false;
}

/** Индикатор здоровья проекта (см. ARCHITECTURE §4). */
export function projectHealth(p: ProjectLike, ref: Date = now()): Health {
  const finished = p.status === 'done' || p.status === 'cancelled';
  const cfg = env.health;

  // ── RED ──
  const overdueMandatory = p.checklist.some((c) => c.mandatory && isOverdue(c, ref));
  const planOverrun = !finished && !!p.plannedEndDate && dayjs(p.plannedEndDate).isBefore(ref);
  const overloadRed = hasOverload(p, cfg.overloadRedPct, ref);
  if (overdueMandatory || planOverrun || overloadRed) return 'risk';

  if (finished) return 'ok';

  // ── YELLOW ──
  const soon = dayjs(ref).add(cfg.deadlineSoonDays, 'day').toDate();
  const deadlineSoon = p.checklist.some(
    (c) => c.mandatory && !isAccepted(c.status) && c.deadline != null
      && dayjs(c.deadline).isAfter(ref) && dayjs(c.deadline).isBefore(soon),
  );
  const behind = forecast(p).behind;

  // На активном этапе не заполнены обязательные документы
  let activeStageGap = false;
  if (p.stages && p.stages.length) {
    const activeStageIds = new Set(p.stages.filter((s) => s.status === 'active').map((s) => s.id));
    if (activeStageIds.size) {
      activeStageGap = (p.checklist as (ChecklistLike & { stageId?: string | null })[]).some(
        (c) => c.mandatory && c.stageId != null && activeStageIds.has(c.stageId) && !isAccepted(c.status),
      );
    }
  }

  if (deadlineSoon || behind || activeStageGap) return 'warn';
  return 'ok';
}

/** Сводка метрик одного проекта для карточки/дашборда. */
export function projectMetrics(p: ProjectLike, ref: Date = now()) {
  const fill = docFill(p);
  const fc = forecast(p);
  return {
    progress: projectProgress(p),
    health: projectHealth(p, ref),
    doc: fill,
    forecast: fc,
    overdueMandatoryCount: p.checklist.filter((c) => c.mandatory && isOverdue(c, ref)).length,
    overdueAnyCount: p.checklist.filter((c) => isOverdue(c, ref)).length,
  };
}
