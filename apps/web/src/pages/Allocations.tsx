import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AllocSummary } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Card, Spinner, Select, EmptyState } from '../components/ui';
import { dayjs } from '../lib/format';

export default function Allocations() {
  const [weeks, setWeeks] = useState(6);
  const { data, isLoading } = useQuery({
    queryKey: ['allocations', weeks],
    queryFn: async () => (await api.get<AllocSummary>(`/allocations?weeks=${weeks}`)).data,
  });

  const cellColor = (level: string, occ: number) => {
    if (occ === 0) return 'bg-surface text-slate-300';
    if (level === 'risk') return 'bg-risk/15 text-risk font-semibold';
    if (level === 'warn') return 'bg-warn/15 text-warn font-medium';
    return 'bg-ok/10 text-ok';
  };

  return (
    <div>
      <PageHeader
        title="Загрузка специалистов"
        subtitle="Недельная занятость по доступным проектам"
        actions={
          <Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-auto">
            <option value={4}>4 недели</option>
            <option value={6}>6 недель</option>
            <option value={8}>8 недель</option>
            <option value={12}>12 недель</option>
          </Select>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : !data?.rows.length ? (
        <EmptyState title="Нет данных о загрузке" hint="Загрузка специалистов заносится на странице проекта" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-ok/40" /> в норме</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-warn/40" /> &gt; {data.thresholds.yellow}%</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-risk/40" /> &gt; {data.thresholds.red}% (перегруз)</span>
          </div>

          <Card className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 bg-surface px-4 py-3 font-medium">Специалист</th>
                  {data.weeks.map((w) => (
                    <th key={w} className="px-3 py-3 text-center font-medium tnum">{dayjs(w).format('DD.MM')}</th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium">Макс.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((r) => (
                  <tr key={r.user.id}>
                    <td className="sticky left-0 bg-card px-4 py-3 font-medium text-ink">
                      {r.user.fullName}
                      {r.overloaded && <span className="ml-2 text-xs text-risk">⚠</span>}
                    </td>
                    {r.cells.map((c) => (
                      <td key={c.weekStart} className="px-1.5 py-1.5 text-center">
                        <div className={`tnum rounded-md py-2 text-xs ${cellColor(c.level, c.occupancyPercent)}`}>
                          {c.occupancyPercent ? `${c.occupancyPercent}%` : '—'}
                        </div>
                      </td>
                    ))}
                    <td className={`tnum px-3 py-3 text-center font-semibold ${r.overloaded ? 'text-risk' : 'text-slate-600'}`}>{r.maxOccupancy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
