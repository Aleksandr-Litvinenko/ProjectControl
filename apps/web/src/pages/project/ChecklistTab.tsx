import { useRef, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { ProjectDetail, ChecklistItem, DocType } from '../../lib/types';
import { Card, Button, ChecklistStatusPill, Input, Select, Label, EmptyState } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { CHECKLIST_STATUS_LABELS, DOC_TYPE_LABELS } from '../../lib/labels';
import { fmtDate, fmtBytes, fmtDateTime, dayjs } from '../../lib/format';
import { useInvalidateProject } from './useProject';

const DOC_TYPES: DocType[] = ['charter', 'project', 'plan', 'tz', 'kp', 'report', 'protocol', 'regulation', 'other'];

export function ChecklistTab({ project, canWrite }: { project: ProjectDetail; canWrite: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'pmo_admin';
  const invalidate = useInvalidateProject(project.id);
  const [addOpen, setAddOpen] = useState(false);
  const [err, setErr] = useState('');

  // группировка по этапам
  const byStage = new Map<string | null, ChecklistItem[]>();
  for (const it of project.checklist) {
    const k = it.stageId ?? null;
    if (!byStage.has(k)) byStage.set(k, []);
    byStage.get(k)!.push(it);
  }
  const stageName = (id: string | null) => project.stages.find((s) => s.id === id)?.name ?? 'Без этапа';

  const isOverdue = (it: ChecklistItem) => it.deadline && it.status !== 'accepted' && dayjs(it.deadline).isBefore(dayjs());

  const act = async (fn: () => Promise<unknown>) => {
    setErr('');
    try { await fn(); invalidate(); } catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <div>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Пункт чек-листа</Button>
        </div>
      )}
      {err && <div className="mb-3 rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}

      {!project.checklist.length ? (
        <EmptyState title="Чек-лист пуст" />
      ) : (
        [...byStage.entries()].map(([stageId, items]) => (
          <div key={stageId ?? 'none'} className="mb-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{stageName(stageId)}</h3>
            <div className="space-y-2">
              {items.sort((a, b) => a.order - b.order).map((it) => (
                <ChecklistRow
                  key={it.id}
                  item={it}
                  project={project}
                  canWrite={canWrite}
                  isAdmin={isAdmin}
                  overdue={!!isOverdue(it)}
                  onAct={act}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {addOpen && <AddItemModal projectId={project.id} onClose={() => setAddOpen(false)} onDone={() => { invalidate(); setAddOpen(false); }} />}
    </div>
  );
}

function ChecklistRow({ item, project, canWrite, isAdmin, overdue, onAct }: {
  item: ChecklistItem; project: ProjectDetail; canWrite: boolean; isAdmin: boolean; overdue: boolean;
  onAct: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const displayStatus = overdue ? 'overdue' : item.status;

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/projects/${project.id}/checklist/${item.id}/documents`, fd);
      await onAct(async () => undefined);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{item.title}</span>
            {item.mandatory && <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">обяз.</span>}
            <span className="text-xs text-slate-400">{DOC_TYPE_LABELS[item.docType]}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {item.deadline && <span className={overdue ? 'text-risk' : ''}>Срок: {fmtDate(item.deadline)}</span>}
            {item.responsible && <span>Отв.: {item.responsible.fullName}</span>}
            {item.requiresPmoApproval && <span className="text-slate-400">требует приёмки ПО</span>}
            {item.documents.length > 0 && (
              <button onClick={() => setExpanded(!expanded)} className="text-primary-600 hover:underline">
                Файлы: {item.documents.length} {expanded ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>

        <ChecklistStatusPill status={displayStatus} />
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {canWrite && (
          <>
            <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? 'Загрузка…' : '↑ Файл'}
            </Button>

            {item.status !== 'accepted' && item.status !== 'in_review' && (
              <Button size="sm" onClick={() => onAct(() => api.post(`/projects/${project.id}/checklist/${item.id}/ready`))}>
                Готов
              </Button>
            )}
          </>
        )}

        {isAdmin && item.status === 'in_review' && (
          <>
            <Button size="sm" onClick={() => onAct(() => api.post(`/projects/${project.id}/checklist/${item.id}/accept`))}>Принять</Button>
            <Button size="sm" variant="outline" onClick={() => onAct(() => api.post(`/projects/${project.id}/checklist/${item.id}/reject`))}>Вернуть</Button>
          </>
        )}

        {item.acceptedBy && <span className="text-xs text-ok">Принял: {item.acceptedBy.fullName}, {fmtDate(item.acceptedAt)}</span>}

        {canWrite && (
          <button
            className="ml-auto text-xs text-slate-400 hover:text-risk"
            onClick={() => confirm('Удалить пункт?') && onAct(() => api.delete(`/projects/${project.id}/checklist/${item.id}`))}
          >
            Удалить
          </button>
        )}
      </div>

      {expanded && item.documents.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {item.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
              <div className="min-w-0">
                <a href={`${api.defaults.baseURL}/projects/${project.id}/documents/${d.id}/download`} className="truncate font-medium text-primary-600 hover:underline">
                  v{d.version} · {d.originalName}
                </a>
                <div className="text-xs text-slate-400">{fmtBytes(d.sizeBytes)} · {d.uploadedBy.fullName} · {fmtDateTime(d.uploadedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AddItemModal({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ title: '', docType: 'other', mandatory: false, requiresPmoApproval: false, deadline: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await api.post(`/projects/${projectId}/checklist`, form);
      onDone();
    } catch (e) { setErr(errorMessage(e)); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Новый пункт чек-листа"
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={saving || !form.title}>Добавить</Button></>}>
      <div className="space-y-4">
        <div><Label>Название</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Тип документа</Label>
          <Select value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
            {DOC_TYPES.map((d) => <option key={d} value={d}>{DOC_TYPE_LABELS[d]}</option>)}
          </Select>
        </div>
        <div><Label>Срок</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.mandatory} onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} /> Обязательный</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiresPmoApproval} onChange={(e) => setForm({ ...form, requiresPmoApproval: e.target.checked })} /> Требует приёмки ПО</label>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}
