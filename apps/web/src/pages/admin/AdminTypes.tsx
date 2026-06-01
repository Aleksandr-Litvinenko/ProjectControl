import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import type { ProjectType, ChecklistTemplate, TemplateItem, DocType } from '../../lib/types';
import { PageHeader } from '../../components/PageHeader';
import { Card, Spinner, Button, Input, Select, Label, EmptyState } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { DOC_TYPE_LABELS } from '../../lib/labels';

const DOC_TYPES: DocType[] = ['charter', 'project', 'plan', 'tz', 'kp', 'report', 'protocol', 'regulation', 'other'];

export default function AdminTypes() {
  const qc = useQueryClient();
  const [typeModal, setTypeModal] = useState(false);
  const [tplEdit, setTplEdit] = useState<ChecklistTemplate | null>(null);

  const { data: types, isLoading } = useQuery({ queryKey: ['admin-types'], queryFn: async () => (await api.get<ProjectType[]>('/admin/project-types')).data });
  const { data: templates } = useQuery({ queryKey: ['admin-templates'], queryFn: async () => (await api.get<ChecklistTemplate[]>('/admin/templates')).data });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-types'] });
    qc.invalidateQueries({ queryKey: ['admin-templates'] });
  };

  return (
    <div>
      <PageHeader title="Типы проектов и шаблоны" subtitle="Чек-лист подставляется по типу проекта" actions={<Button onClick={() => setTypeModal(true)}>+ Тип проекта</Button>} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : (
        <div className="space-y-4">
          {types?.map((t) => {
            const tpl = templates?.find((x) => x.projectType.id === t.id);
            return (
              <Card key={t.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg text-ink">{t.name}</h3>
                    {t.description && <p className="mt-0.5 text-sm text-slate-500">{t.description}</p>}
                    <p className="mt-1 text-xs text-slate-400">Проектов: {t._count?.projects ?? 0}</p>
                  </div>
                  {tpl && <Button size="sm" variant="outline" onClick={() => setTplEdit(tpl)}>Редактировать чек-лист</Button>}
                </div>
                {tpl && (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Пункты чек-листа ({tpl.items.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {tpl.items.map((it, i) => (
                        <span key={i} className={`rounded-lg border px-2.5 py-1 text-xs ${it.mandatory ? 'border-primary/30 bg-primary/5 text-primary-600' : 'border-border text-slate-500'}`}>
                          {it.title}
                          {it.mandatory && ' *'}
                          {it.requiresPmoApproval && ' ✓ПО'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          {!types?.length && <EmptyState title="Типов проектов нет" />}
        </div>
      )}

      {typeModal && <TypeModal onClose={() => setTypeModal(false)} onDone={() => { invalidate(); setTypeModal(false); }} />}
      {tplEdit && <TemplateModal template={tplEdit} onClose={() => setTplEdit(null)} onDone={() => { invalidate(); setTplEdit(null); }} />}
    </div>
  );
}

function TypeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', description: '' });
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    try { await api.post('/admin/project-types', f); onDone(); } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Новый тип проекта"
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!f.name}>Создать</Button></>}>
      <div className="space-y-4">
        <div><Label>Название</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Внедрение 1С:УНФ" /></div>
        <div><Label>Описание</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}

function TemplateModal({ template, onClose, onDone }: { template: ChecklistTemplate; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(template.name);
  const [items, setItems] = useState<TemplateItem[]>(template.items.map((it) => ({ ...it })));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, { title: '', docType: 'other', mandatory: false, requiresPmoApproval: false, stageHint: null, defaultOrder: items.length + 1 }]);
  const upd = (i: number, patch: Partial<TemplateItem>) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const del = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await api.put(`/admin/templates/${template.id}`, {
        name,
        items: items.filter((it) => it.title.trim()).map((it, i) => ({ ...it, defaultOrder: i + 1 })),
      });
      onDone();
    } catch (e) { setErr(errorMessage(e)); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Чек-лист: ${template.projectType.name}`} wide
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button></>}>
      <div className="space-y-4">
        <div><Label>Название шаблона</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">Пункты</Label>
            <Button size="sm" variant="outline" onClick={addItem}>+ Пункт</Button>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input value={it.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Название пункта" className="flex-1" />
                  <Select value={it.docType} onChange={(e) => upd(i, { docType: e.target.value as DocType })} className="w-32">
                    {DOC_TYPES.map((d) => <option key={d} value={d}>{DOC_TYPE_LABELS[d]}</option>)}
                  </Select>
                  <button onClick={() => del(i)} className="px-2 text-slate-400 hover:text-risk" aria-label="Удалить">✕</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={it.mandatory} onChange={(e) => upd(i, { mandatory: e.target.checked })} /> Обязательный</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={it.requiresPmoApproval} onChange={(e) => upd(i, { requiresPmoApproval: e.target.checked })} /> Требует приёмки ПО</label>
                </div>
              </div>
            ))}
            {!items.length && <p className="text-sm text-slate-400">Пунктов нет — добавьте первый.</p>}
          </div>
        </div>
        {err && <div className="rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{err}</div>}
      </div>
    </Modal>
  );
}
