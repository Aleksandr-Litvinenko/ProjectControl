import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ProjectListItem, ProjectType, UserRow } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Card, Spinner, ProjectStatusPill, Button, Input, Select, Label, EmptyState } from '../components/ui';
import { Modal } from '../components/Modal';
import { fmtDate } from '../lib/format';
import { PROJECT_STATUS_LABELS } from '../lib/labels';

export default function Projects() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'pmo_admin';
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await api.get<ProjectListItem[]>('/projects')).data,
  });

  return (
    <div>
      <PageHeader
        title="Проекты"
        subtitle={isAdmin ? 'Все проекты' : 'Доступные вам проекты'}
        actions={isAdmin ? <Button onClick={() => setOpen(true)}>+ Новый проект</Button> : undefined}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : !projects?.length ? (
        <EmptyState title="Проектов нет" hint={isAdmin ? 'Создайте первый проект' : 'Дождитесь назначения доступа'} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium leading-snug text-ink">{p.title}</h3>
                  <ProjectStatusPill status={p.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{p.client}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>{p.projectType?.name}</span>
                  <span>РП: {p.pm?.fullName ?? '—'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-slate-500">
                  <span>{p._count?.checklist ?? 0} пунктов · {p._count?.tasks ?? 0} задач</span>
                  <span className="tnum">{fmtDate(p.plannedEndDate)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {open && <CreateProjectModal onClose={() => setOpen(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['projects'] }); setOpen(false); }} />}
    </div>
  );
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', client: '', projectTypeId: '', pmUserId: '', status: 'planned', startDate: '', plannedEndDate: '', description: '' });
  const [error, setError] = useState('');

  const { data: types } = useQuery({ queryKey: ['catalog-types'], queryFn: async () => (await api.get<ProjectType[]>('/catalog/project-types')).data });
  const { data: pms } = useQuery({ queryKey: ['admin-users-pm'], queryFn: async () => (await api.get<UserRow[]>('/admin/users')).data.filter((u) => u.role === 'pm') });

  const mut = useMutation({
    mutationFn: async () => (await api.post('/projects', form)).data,
    onSuccess: onCreated,
    onError: (e) => setError(errorMessage(e)),
  });

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <Modal
      open
      onClose={onClose}
      title="Новый проект"
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => { setError(''); mut.mutate(); }} disabled={mut.isPending || !form.title || !form.client || !form.projectTypeId}>
            {mut.isPending ? 'Создание…' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Название проекта</Label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Внедрение 1С:ERP в …" />
        </div>
        <div>
          <Label>Заказчик</Label>
          <Input value={form.client} onChange={(e) => set('client', e.target.value)} placeholder="ООО «…»" />
        </div>
        <div>
          <Label>Тип проекта</Label>
          <Select value={form.projectTypeId} onChange={(e) => set('projectTypeId', e.target.value)}>
            <option value="">— выберите —</option>
            {types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <p className="mt-1 text-xs text-slate-400">Чек-лист подставится по типу</p>
        </div>
        <div>
          <Label>Руководитель проекта</Label>
          <Select value={form.pmUserId} onChange={(e) => set('pmUserId', e.target.value)}>
            <option value="">— не назначен —</option>
            {pms?.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </Select>
        </div>
        <div>
          <Label>Статус</Label>
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div>
          <Label>Дата старта</Label>
          <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div>
          <Label>Плановое завершение</Label>
          <Input type="date" value={form.plannedEndDate} onChange={(e) => set('plannedEndDate', e.target.value)} />
        </div>
      </div>
      {error && <div className="mt-4 rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{error}</div>}
    </Modal>
  );
}
