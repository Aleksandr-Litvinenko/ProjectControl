import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { DashboardResponse, ProjectType, UserRow } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Card, Spinner, ProgressBar, HealthPill, ProjectStatusPill, Select, Input, Button, EmptyState } from '../components/ui';
import { fmtDate } from '../lib/format';
import { PROJECT_STATUS_LABELS } from '../lib/labels';

interface Filters { status: string; projectTypeId: string; pmUserId: string; client: string }

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'pmo_admin';
  const [filters, setFilters] = useState<Filters>({ status: '', projectTypeId: '', pmUserId: '', client: '' });

  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: async () => (await api.get<DashboardResponse>(`/dashboard?${qs}`)).data,
  });

  const { data: types } = useQuery({
    queryKey: ['catalog-types'],
    queryFn: async () => (await api.get<ProjectType[]>('/catalog/project-types')).data,
  });

  const { data: pms } = useQuery({
    queryKey: ['admin-users-pm'],
    queryFn: async () => (await api.get<UserRow[]>('/admin/users')).data.filter((u) => u.role === 'pm'),
    enabled: isAdmin,
  });

  const exportUrl = (fmt: 'xlsx' | 'pdf') => `${api.defaults.baseURL}/export/dashboard.${fmt}${qs ? `?${qs}` : ''}`;

  const s = data?.summary;

  return (
    <div>
      <PageHeader
        title="Дашборд портфеля"
        subtitle={isAdmin ? 'Все проекты организации' : 'Доступные вам проекты'}
        actions={
          <>
            <a href={exportUrl('xlsx')}><Button variant="outline" size="sm">Excel</Button></a>
            <a href={exportUrl('pdf')}><Button variant="outline" size="sm">PDF</Button></a>
          </>
        }
      />

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Активных проектов" value={s?.activeProjects} sub={`всего ${s?.totalProjects ?? '—'}`} delay={0} />
        <Kpi label="Документация" value={s ? `${s.docFillPortfolio}%` : undefined} sub="по портфелю" delay={60} />
        <Kpi label="В риске" value={s?.projectsAtRisk} sub={s ? `🔴 ${s.riskRed} · 🟡 ${s.riskYellow}` : ''} accent="warn" delay={120} />
        <Kpi label="Просрочено пунктов" value={s?.overdueChecklistItems} accent={s?.overdueChecklistItems ? 'risk' : undefined} delay={180} />
        <Kpi label="Перегружены" value={s?.overloadedSpecialists} sub=">100% загрузки" accent={s?.overloadedSpecialists ? 'risk' : undefined} delay={240} />
      </div>

      {/* Filters */}
      <Card className="mb-4 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Все статусы</option>
            {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={filters.projectTypeId} onChange={(e) => setFilters({ ...filters, projectTypeId: e.target.value })}>
            <option value="">Все типы</option>
            {types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {isAdmin ? (
            <Select value={filters.pmUserId} onChange={(e) => setFilters({ ...filters, pmUserId: e.target.value })}>
              <option value="">Все РП</option>
              {pms?.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </Select>
          ) : <div className="hidden lg:block" />}
          <Input placeholder="Поиск по заказчику" value={filters.client} onChange={(e) => setFilters({ ...filters, client: e.target.value })} />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : !data?.rows.length ? (
        <EmptyState title="Проектов не найдено" hint="Измените фильтры или дождитесь назначения доступа" />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Проект</th>
                  <th className="px-4 py-3 font-medium">Заказчик</th>
                  <th className="px-4 py-3 font-medium">РП</th>
                  <th className="px-4 py-3 font-medium">Тип</th>
                  <th className="px-4 py-3 font-medium">Прогресс</th>
                  <th className="px-4 py-3 font-medium">Документация</th>
                  <th className="px-4 py-3 font-medium">Здоровье</th>
                  <th className="px-4 py-3 font-medium">Срок</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((r) => (
                  <tr key={r.id} className="group hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${r.id}`} className="font-medium text-ink hover:text-primary-600">{r.title}</Link>
                      <div className="mt-0.5"><ProjectStatusPill status={r.status} /></div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.client}</td>
                    <td className="px-4 py-3 text-slate-600">{r.pm?.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{r.projectType?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={r.progress} className="w-24" />
                        <span className="tnum text-xs text-slate-500">{r.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="tnum text-ink">{r.doc.acceptedAll}/{r.doc.totalAll}</span>
                      <span className="ml-2 text-xs text-slate-400">обяз. {r.doc.acceptedMand}/{r.doc.totalMand}</span>
                    </td>
                    <td className="px-4 py-3"><HealthPill health={r.health} /></td>
                    <td className="px-4 py-3">
                      <div className="tnum text-slate-600">{fmtDate(r.plannedEndDate)}</div>
                      <ForecastHint behind={r.forecast.behind} delta={r.forecast.deltaDays} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {data.rows.map((r) => (
              <Link key={r.id} to={`/projects/${r.id}`}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{r.title}</div>
                      <div className="truncate text-sm text-slate-500">{r.client}</div>
                    </div>
                    <HealthPill health={r.health} withLabel={false} />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <ProgressBar value={r.progress} />
                    <span className="tnum text-xs text-slate-500">{r.progress}%</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>Док.: {r.doc.acceptedAll}/{r.doc.totalAll} (обяз. {r.doc.acceptedMand}/{r.doc.totalMand})</span>
                    <span className="tnum">{fmtDate(r.plannedEndDate)}</span>
                  </div>
                  <div className="mt-2"><ProjectStatusPill status={r.status} /></div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent, delay = 0 }: { label: string; value?: number | string; sub?: string; accent?: 'warn' | 'risk'; delay?: number }) {
  return (
    <Card
      className="animate-[fadeUp_.5s_ease_both] p-4"
      // staggered reveal
    >
      <div style={{ animationDelay: `${delay}ms` }}>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className={`tnum mt-2 font-display text-3xl ${accent === 'risk' ? 'text-risk' : accent === 'warn' ? 'text-warn' : 'text-ink'}`}>
          {value ?? '—'}
        </div>
        {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
      </div>
    </Card>
  );
}

function ForecastHint({ behind, delta }: { behind: boolean; delta: number }) {
  if (!delta) return null;
  return (
    <div className={`text-xs ${behind ? 'text-risk' : 'text-ok'}`}>
      {behind ? `отставание ${Math.abs(delta)} дн.` : `опережение ${delta} дн.`}
    </div>
  );
}
