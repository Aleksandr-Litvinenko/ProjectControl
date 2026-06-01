import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import type { ProjectDetail, Task } from '../../lib/types';
import { Card, Button, Input, Select, Label, EmptyState, ProgressBar } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { Gantt } from '../../components/Gantt';
import { TASK_STATUS_LABELS, STAGE_STATUS_LABELS } from '../../lib/labels';
import { fmtDate } from '../../lib/format';
import { useInvalidateProject } from './useProject';
import { useAuth } from '../../lib/auth';

export function TimelineTab({ project, canWrite }: { project: ProjectDetail; canWrite: boolean }) {
  const { user } = useAuth();
  const invalidate = useInvalidateProject(project.id);
  const [modal, setModal] = useState<null | 'stage' | 'task' | 'milestone'>(null);
  const [err, setErr] = useState('');

  const act = async (fn: () => Promise<unknown>) => {
    setErr('');
    try { await fn(); invalidate(); } catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setModal('stage')}>+ Этап</Button>
          <Button size="sm" variant="outline" onClick={() => setModal('task')}>+ Задача</Button>
          <Button size="sm" variant="outline" onClick={() => setModal('milestone')}>+ Веха</Button>
        </div>
      )}
      {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}

      <Card className="p-4">
        <h3 className="mb-4 font-display text-lg text-ink">Диаграмма Ганта</h3>
        <Gantt stages={project.stages} tasks={project.tasks} milestones={project.milestones} />
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-display text-lg text-ink">Задачи</h3>
        {!project.tasks.length ? (
          <EmptyState title="Задач нет" />
        ) : (
          <div className="space-y-2">
            {project.tasks.map((t) => (
              <TaskRow key={t.id} task={t} project={project} canWrite={canWrite} ownAssignee={t.assigneeUserId === user?.id} onAct={act} />
            ))}
          </div>
        )}
      </Card>

      {project.milestones.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 font-display text-lg text-ink">Вехи</h3>
          <div className="flex flex-wrap gap-3">
            {project.milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span style={{ color: m.reached ? 'var(--ok)' : 'var(--warn)' }}>◆</span>
                <span className="text-ink">{m.title}</span>
                <span className="tnum text-slate-400">{fmtDate(m.date)}</span>
                {canWrite && (
                  <button
                    onClick={() => act(() => api.patch(`/projects/${project.id}/milestones/${m.id}`, { reached: !m.reached }))}
                    className="ml-1 text-xs text-primary-600 hover:underline"
                  >
                    {m.reached ? 'снять' : 'достигнута'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {modal === 'stage' && <StageModal project={project} onClose={() => setModal(null)} onDone={() => { invalidate(); setModal(null); }} />}
      {modal === 'task' && <TaskModal project={project} onClose={() => setModal(null)} onDone={() => { invalidate(); setModal(null); }} />}
      {modal === 'milestone' && <MilestoneModal project={project} onClose={() => setModal(null)} onDone={() => { invalidate(); setModal(null); }} />}
    </div>
  );
}

function TaskRow({ task, project, canWrite, ownAssignee, onAct }: {
  task: Task; project: ProjectDetail; canWrite: boolean; ownAssignee: boolean;
  onAct: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const editable = canWrite || ownAssignee;
  const [progress, setProgress] = useState(task.progressPercent);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-ink">{task.title}</span>
          <div className="mt-0.5 text-xs text-slate-500">
            {task.assignee?.fullName ?? 'без исполнителя'} · {TASK_STATUS_LABELS[task.status]}
            {task.startDate && task.endDate && <> · {fmtDate(task.startDate)} – {fmtDate(task.endDate)}</>}
          </div>
        </div>
        {canWrite && (
          <button onClick={() => confirm('Удалить задачу?') && onAct(() => api.delete(`/projects/${project.id}/tasks/${task.id}`))} className="text-xs text-slate-400 hover:text-risk">
            Удалить
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <ProgressBar value={progress} />
        <span className="tnum w-10 text-right text-xs text-slate-500">{progress}%</span>
      </div>
      {editable && (
        <div className="mt-2 flex items-center gap-2">
          <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" />
          {progress !== task.progressPercent && (
            <Button size="sm" onClick={() => onAct(() => api.patch(`/projects/${project.id}/tasks/${task.id}`, { progressPercent: progress }))}>Сохранить</Button>
          )}
        </div>
      )}
    </div>
  );
}

function StageModal({ project, onClose, onDone }: { project: ProjectDetail; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', order: project.stages.length + 1, startDate: '', endDate: '', status: 'planned' });
  const [err, setErr] = useState('');
  const save = async () => {
    try { await api.post(`/projects/${project.id}/stages`, f); onDone(); } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Новый этап"
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!f.name}>Добавить</Button></>}>
      <div className="space-y-4">
        <div><Label>Название</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Начало</Label><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><Label>Окончание</Label><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        <div><Label>Статус</Label>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {Object.entries(STAGE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}

function TaskModal({ project, onClose, onDone }: { project: ProjectDetail; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', stageId: '', assigneeUserId: '', startDate: '', endDate: '', progressPercent: 0, status: 'not_started' });
  const [err, setErr] = useState('');
  const specialists = project.access.filter((a) => a.user.role === 'specialist' || a.accessRole === 'specialist');
  const save = async () => {
    try { await api.post(`/projects/${project.id}/tasks`, f); onDone(); } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Новая задача"
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!f.title}>Добавить</Button></>}>
      <div className="space-y-4">
        <div><Label>Название</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Этап</Label>
            <Select value={f.stageId} onChange={(e) => setF({ ...f, stageId: e.target.value })}>
              <option value="">—</option>
              {project.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div><Label>Исполнитель</Label>
            <Select value={f.assigneeUserId} onChange={(e) => setF({ ...f, assigneeUserId: e.target.value })}>
              <option value="">—</option>
              {specialists.map((a) => <option key={a.userId} value={a.userId}>{a.user.fullName}</option>)}
            </Select>
          </div>
          <div><Label>Начало</Label><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><Label>Окончание</Label><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}

function MilestoneModal({ project, onClose, onDone }: { project: ProjectDetail; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', date: '' });
  const [err, setErr] = useState('');
  const save = async () => {
    try { await api.post(`/projects/${project.id}/milestones`, f); onDone(); } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Новая веха"
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!f.title || !f.date}>Добавить</Button></>}>
      <div className="space-y-4">
        <div><Label>Название</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><Label>Дата</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}
