import { useMemo } from 'react';
import type { ProjectDetail } from '../../lib/types';
import { Card, ProgressBar, HealthPill } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import { PROJECT_STATUS_LABELS } from '../../lib/labels';
import { computeMetrics } from './metrics';

export function OverviewTab({ project }: { project: ProjectDetail }) {
  const m = useMemo(() => computeMetrics(project), [project]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Прогресс">
          <div className="tnum font-display text-3xl text-ink">{m.progress}%</div>
          <ProgressBar value={m.progress} className="mt-2" />
        </Metric>
        <Metric label="Здоровье"><div className="mt-1"><HealthPill health={m.health} /></div></Metric>
        <Metric label="Документация">
          <div className="tnum font-display text-3xl text-ink">{m.doc.acceptedAll}/{m.doc.totalAll}</div>
          <div className="mt-1 text-xs text-slate-400">обязательные {m.doc.acceptedMand}/{m.doc.totalMand}</div>
        </Metric>
        <Metric label="Прогноз">
          {m.forecast.deltaDays === 0 ? (
            <div className="font-display text-lg text-slate-500">по плану</div>
          ) : (
            <div className={`font-display text-lg ${m.forecast.behind ? 'text-risk' : 'text-ok'}`}>
              {m.forecast.behind ? `−${Math.abs(m.forecast.deltaDays)} дн.` : `+${m.forecast.deltaDays} дн.`}
            </div>
          )}
          <div className="mt-1 text-xs text-slate-400">факт {m.forecast.actualPercent}% · ожид. {m.forecast.expectedPercent}%</div>
        </Metric>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg text-ink">О проекте</h3>
        <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Заказчик" value={project.client} />
          <Field label="Тип проекта" value={project.projectType?.name ?? '—'} />
          <Field label="Руководитель проекта" value={project.pm?.fullName ?? '—'} />
          <Field label="Статус" value={PROJECT_STATUS_LABELS[project.status]} />
          <Field label="Дата старта" value={fmtDate(project.startDate)} />
          <Field label="Плановое завершение" value={fmtDate(project.plannedEndDate)} />
          {project.actualEndDate && <Field label="Фактическое завершение" value={fmtDate(project.actualEndDate)} />}
        </dl>
        {project.description && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-1 text-sm font-medium text-slate-500">Описание</div>
            <p className="whitespace-pre-wrap text-sm text-ink">{project.description}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1">{children}</div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
