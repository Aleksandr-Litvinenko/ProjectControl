import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import type { ProjectDetail } from '../../lib/types';
import { Card, Button, Input, Select, Label, EmptyState } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { fmtDate } from '../../lib/format';
import { useInvalidateProject } from './useProject';

export function AllocationsTab({ project, canWrite }: { project: ProjectDetail; canWrite: boolean }) {
  const invalidate = useInvalidateProject(project.id);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  // суммарная занятость по специалисту (для предупреждения о перегрузе)
  const totals = new Map<string, number>();
  for (const a of project.allocations) totals.set(a.userId, (totals.get(a.userId) ?? 0) + a.occupancyPercent);
  const overloadedUsers = new Set([...totals.entries()].filter(([, v]) => v > 100).map(([k]) => k));

  const del = async (id: string) => {
    setErr('');
    try { await api.delete(`/projects/${project.id}/allocations/${id}`); invalidate(); } catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <div>
      {canWrite && <div className="mb-4 flex justify-end"><Button size="sm" onClick={() => setOpen(true)}>+ Загрузка</Button></div>}
      {err && <div className="mb-3 rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}

      {overloadedUsers.size > 0 && (
        <div className="mb-4 rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">
          ⚠ Перегрузка по проекту: суммарная занятость некоторых специалистов превышает 100%
        </div>
      )}

      {!project.allocations.length ? (
        <EmptyState title="Загрузка не заведена" hint={canWrite ? 'Добавьте загрузку специалистов' : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Специалист</th>
                <th className="px-4 py-3 font-medium">Период</th>
                <th className="px-4 py-3 font-medium">Часов/день</th>
                <th className="px-4 py-3 font-medium">Занятость</th>
                {canWrite && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {project.allocations.map((a) => (
                <tr key={a.id} className="hover:bg-surface/60">
                  <td className="px-4 py-3 font-medium text-ink">
                    {a.user.fullName}
                    {overloadedUsers.has(a.userId) && <span className="ml-2 text-xs text-risk">перегрузка</span>}
                  </td>
                  <td className="tnum px-4 py-3 text-slate-600">{fmtDate(a.periodStart)} – {fmtDate(a.periodEnd)}</td>
                  <td className="tnum px-4 py-3 text-slate-600">{a.hoursPerDay}</td>
                  <td className="px-4 py-3">
                    <span className={`tnum font-medium ${a.occupancyPercent > 100 ? 'text-risk' : a.occupancyPercent > 80 ? 'text-warn' : 'text-ink'}`}>
                      {a.occupancyPercent}%
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => del(a.id)} className="text-xs text-slate-400 hover:text-risk">Удалить</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {open && <AllocModal project={project} onClose={() => setOpen(false)} onDone={() => { invalidate(); setOpen(false); }} />}
    </div>
  );
}

function AllocModal({ project, onClose, onDone }: { project: ProjectDetail; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ userId: '', periodStart: '', periodEnd: '', hoursPerDay: 8, occupancyPercent: 100 });
  const [err, setErr] = useState('');
  const specialists = project.access.filter((a) => a.user.role === 'specialist' || a.accessRole === 'specialist');

  const save = async () => {
    setErr('');
    try { await api.post(`/projects/${project.id}/allocations`, f); onDone(); } catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <Modal open onClose={onClose} title="Загрузка специалиста"
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!f.userId || !f.periodStart || !f.periodEnd}>Добавить</Button></>}>
      <div className="space-y-4">
        <div><Label>Специалист</Label>
          <Select value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })}>
            <option value="">— выберите —</option>
            {specialists.map((a) => <option key={a.userId} value={a.userId}>{a.user.fullName}</option>)}
          </Select>
          {!specialists.length && <p className="mt-1 text-xs text-warn">Сначала добавьте специалистов в команду проекта</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Начало периода</Label><Input type="date" value={f.periodStart} onChange={(e) => setF({ ...f, periodStart: e.target.value })} /></div>
          <div><Label>Конец периода</Label><Input type="date" value={f.periodEnd} onChange={(e) => setF({ ...f, periodEnd: e.target.value })} /></div>
          <div><Label>Часов в день</Label><Input type="number" min={0} max={24} step={0.5} value={f.hoursPerDay} onChange={(e) => setF({ ...f, hoursPerDay: Number(e.target.value) })} /></div>
          <div><Label>Занятость, %</Label><Input type="number" min={0} max={500} value={f.occupancyPercent} onChange={(e) => setF({ ...f, occupancyPercent: Number(e.target.value) })} /></div>
        </div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}
