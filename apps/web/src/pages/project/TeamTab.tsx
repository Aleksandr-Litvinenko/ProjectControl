import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import type { ProjectDetail, UserRow, AccessRole } from '../../lib/types';
import { Card, Button, Select, Label, EmptyState } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { ROLE_LABELS } from '../../lib/labels';
import { useInvalidateProject } from './useProject';

const ACCESS_ROLE_LABELS: Record<AccessRole, string> = {
  pm: 'Руководитель проекта',
  specialist: 'Специалист',
  observer: 'Наблюдатель',
  client: 'Заказчик',
};

export function TeamTab({ project, isAdmin }: { project: ProjectDetail; isAdmin: boolean }) {
  const invalidate = useInvalidateProject(project.id);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  const revoke = async (userId: string) => {
    setErr('');
    try { await api.delete(`/projects/${project.id}/access/${userId}`); invalidate(); } catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <div>
      {isAdmin && <div className="mb-4 flex justify-end"><Button size="sm" onClick={() => setOpen(true)}>+ Участник</Button></div>}
      {err && <div className="mb-3 rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}

      {!project.access.length ? (
        <EmptyState title="Участников нет" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Участник</th>
                <th className="px-4 py-3 font-medium">Логин</th>
                <th className="px-4 py-3 font-medium">Роль в проекте</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {project.access.map((a) => (
                <tr key={a.id} className="hover:bg-surface/60">
                  <td className="px-4 py-3 font-medium text-ink">{a.user.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{a.user.login}</td>
                  <td className="px-4 py-3 text-slate-600">{ACCESS_ROLE_LABELS[a.accessRole]}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => revoke(a.userId)} className="text-xs text-slate-400 hover:text-risk">Убрать</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {open && <AddMemberModal project={project} onClose={() => setOpen(false)} onDone={() => { invalidate(); setOpen(false); }} />}
    </div>
  );
}

function AddMemberModal({ project, onClose, onDone }: { project: ProjectDetail; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<{ userId: string; accessRole: AccessRole }>({ userId: '', accessRole: 'specialist' });
  const [err, setErr] = useState('');
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await api.get<UserRow[]>('/admin/users')).data });
  const existing = new Set(project.access.map((a) => a.userId));
  const available = users?.filter((u) => u.isActive && !existing.has(u.id)) ?? [];

  const save = async () => {
    setErr('');
    try { await api.post(`/projects/${project.id}/access`, f); onDone(); } catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <Modal open onClose={onClose} title="Добавить участника"
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!f.userId}>Добавить</Button></>}>
      <div className="space-y-4">
        <div><Label>Пользователь</Label>
          <Select value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })}>
            <option value="">— выберите —</option>
            {available.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({ROLE_LABELS[u.role]})</option>)}
          </Select>
        </div>
        <div><Label>Роль в проекте</Label>
          <Select value={f.accessRole} onChange={(e) => setF({ ...f, accessRole: e.target.value as AccessRole })}>
            {Object.entries(ACCESS_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}
