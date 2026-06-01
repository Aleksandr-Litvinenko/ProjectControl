import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import type { UserRow, Role } from '../../lib/types';
import { PageHeader } from '../../components/PageHeader';
import { Card, Spinner, Button, Input, Select, Label, EmptyState } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { ROLE_LABELS } from '../../lib/labels';
import { fmtDate } from '../../lib/format';

const ROLES: Role[] = ['pmo_admin', 'pm', 'specialist', 'observer', 'client'];

export default function AdminUsers() {
  const qc = useQueryClient();
  const [create, setCreate] = useState(false);
  const [reset, setReset] = useState<UserRow | null>(null);
  const { data: users, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await api.get<UserRow[]>('/admin/users')).data });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-users'] });

  const toggleActive = async (u: UserRow) => {
    await api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive });
    invalidate();
  };

  return (
    <div>
      <PageHeader title="Пользователи" subtitle="Управление учётными записями" actions={<Button onClick={() => setCreate(true)}>+ Пользователь</Button>} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : !users?.length ? (
        <EmptyState title="Пользователей нет" />
      ) : (
        <Card className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">ФИО</th>
                <th className="px-4 py-3 font-medium">Логин</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th className="px-4 py-3 font-medium">Проектов</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-surface/60 ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-ink">{u.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{u.login}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[u.role]}</td>
                  <td className="tnum px-4 py-3 text-slate-500">{u._count?.access ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${u.isActive ? 'bg-ok/10 text-ok' : 'bg-slate-100 text-slate-500'}`}>
                      {u.isActive ? 'активен' : 'отключён'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      <button onClick={() => setReset(u)} className="text-primary-600 hover:underline">Сброс пароля</button>
                      <button onClick={() => toggleActive(u)} className="text-slate-400 hover:text-ink">{u.isActive ? 'Отключить' : 'Включить'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {create && <CreateUserModal onClose={() => setCreate(false)} onDone={() => { invalidate(); setCreate(false); }} />}
      {reset && <ResetPasswordModal user={reset} onClose={() => setReset(null)} onDone={() => setReset(null)} />}
    </div>
  );
}

function CreateUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ fullName: '', login: '', email: '', role: 'specialist' as Role, password: '' });
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    try { await api.post('/admin/users', f); onDone(); } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Новый пользователь"
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!f.fullName || f.login.length < 2 || f.password.length < 6}>Создать</Button></>}>
      <div className="space-y-4">
        <div><Label>ФИО</Label><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Логин</Label><Input value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} placeholder="латиница" /></div>
          <div><Label>Роль</Label>
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </div>
        </div>
        <div><Label>Email (необязательно)</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><Label>Пароль</Label><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="минимум 6 символов" /></div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const save = async () => {
    setErr('');
    try { await api.post(`/admin/users/${user.id}/reset-password`, { newPassword: pw }); setDone(true); setTimeout(onDone, 800); } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <Modal open onClose={onClose} title={`Сброс пароля: ${user.fullName}`}
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={pw.length < 6 || done}>{done ? 'Готово ✓' : 'Сбросить'}</Button></>}>
      <div className="space-y-3">
        <div><Label>Новый пароль</Label><Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="минимум 6 символов" /></div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}
