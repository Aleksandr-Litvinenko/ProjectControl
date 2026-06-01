import { useMemo } from 'react';
import type { Stage, Task, Milestone } from '../lib/types';
import { dayjs } from '../lib/format';
import { EmptyState } from './ui';

interface Props {
  stages: Stage[];
  tasks: Task[];
  milestones: Milestone[];
}

interface Bar { id: string; label: string; start: dayjs.Dayjs; end: dayjs.Dayjs; progress?: number; kind: 'stage' | 'task' }

/** Простая диаграмма Ганта на CSS (кириллица в подписях — нативно). */
export function Gantt({ stages, tasks, milestones }: Props) {
  const model = useMemo(() => {
    const bars: Bar[] = [];
    for (const s of stages) {
      if (s.startDate && s.endDate) bars.push({ id: s.id, label: s.name, start: dayjs(s.startDate), end: dayjs(s.endDate), kind: 'stage' });
    }
    for (const t of tasks) {
      if (t.startDate && t.endDate) bars.push({ id: t.id, label: t.title, start: dayjs(t.startDate), end: dayjs(t.endDate), progress: t.progressPercent, kind: 'task' });
    }
    const ms = milestones.filter((m) => m.date).map((m) => ({ ...m, d: dayjs(m.date) }));

    const allDates = [...bars.flatMap((b) => [b.start, b.end]), ...ms.map((m) => m.d)];
    if (!allDates.length) return null;

    let min = allDates[0], max = allDates[0];
    for (const d of allDates) { if (d.isBefore(min)) min = d; if (d.isAfter(max)) max = d; }
    min = min.subtract(2, 'day').startOf('day');
    max = max.add(2, 'day').endOf('day');
    const totalDays = Math.max(1, max.diff(min, 'day'));

    // Метки месяцев
    const months: { label: string; left: number }[] = [];
    let cur = min.startOf('month');
    while (cur.isBefore(max)) {
      const left = (cur.diff(min, 'day') / totalDays) * 100;
      if (left >= 0) months.push({ label: cur.format('MMM YY'), left });
      cur = cur.add(1, 'month');
    }

    const pos = (d: dayjs.Dayjs) => (d.diff(min, 'day') / totalDays) * 100;
    const todayLeft = pos(dayjs());
    const showToday = todayLeft >= 0 && todayLeft <= 100;

    return { bars, ms, min, max, totalDays, months, pos, todayLeft, showToday };
  }, [stages, tasks, milestones]);

  if (!model) return <EmptyState title="Нет данных для диаграммы" hint="Добавьте этапам и задачам даты начала и окончания" />;

  const ROW_H = 38;
  const height = model.bars.length * ROW_H + 30;

  return (
    <div className="thin-scroll overflow-x-auto">
      <div className="min-w-[680px]">
        {/* Шкала месяцев */}
        <div className="relative mb-1 h-5 border-b border-border text-[11px] text-slate-400">
          {model.months.map((m, i) => (
            <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${m.left}%` }}>{m.label}</span>
          ))}
        </div>

        <div className="relative" style={{ height }}>
          {/* Линия "сегодня" */}
          {model.showToday && (
            <div className="absolute top-0 z-10 h-full border-l-2 border-dashed border-primary/50" style={{ left: `${model.todayLeft}%` }}>
              <span className="absolute -top-0 left-1 text-[10px] font-medium text-primary-600">сегодня</span>
            </div>
          )}

          {/* Бары */}
          {model.bars.map((b, i) => {
            const left = model.pos(b.start);
            const width = Math.max(1.5, model.pos(b.end) - left);
            const isStage = b.kind === 'stage';
            return (
              <div key={b.id} className="absolute flex items-center" style={{ top: i * ROW_H + 4, left: 0, right: 0, height: ROW_H - 8 }}>
                <div
                  className="group absolute h-7 rounded-md"
                  style={{ left: `${left}%`, width: `${width}%`, background: isStage ? 'var(--ink)' : 'var(--viz)', opacity: isStage ? 0.85 : 1 }}
                  title={`${b.label}: ${b.start.format('DD.MM')} – ${b.end.format('DD.MM.YYYY')}${b.progress != null ? ` · ${b.progress}%` : ''}`}
                >
                  {b.kind === 'task' && b.progress != null && (
                    <div className="h-full rounded-md bg-primary/70" style={{ width: `${b.progress}%` }} />
                  )}
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 truncate pr-2 text-[11px] font-medium text-white" style={{ maxWidth: '100%' }}>
                    {b.label}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Вехи */}
          {model.ms.map((m) => {
            const left = model.pos(m.d);
            if (left < 0 || left > 100) return null;
            return (
              <div key={m.id} className="absolute z-20 -translate-x-1/2" style={{ left: `${left}%`, top: 0, height: '100%' }} title={`${m.title}: ${m.d.format('DD.MM.YYYY')}`}>
                <div className="flex h-full flex-col items-center">
                  <span className="text-sm" style={{ color: m.reached ? 'var(--ok)' : 'var(--warn)' }}>◆</span>
                  <div className="h-full border-l border-dotted border-slate-300" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Легенда */}
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded" style={{ background: 'var(--ink)', opacity: .85 }} /> Этап</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded" style={{ background: 'var(--viz)' }} /> Задача</span>
          <span className="flex items-center gap-1.5"><span style={{ color: 'var(--ok)' }}>◆</span> веха (достигнута)</span>
          <span className="flex items-center gap-1.5"><span style={{ color: 'var(--warn)' }}>◆</span> веха (план)</span>
        </div>
      </div>
    </div>
  );
}
