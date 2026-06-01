import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AuditEntry } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Card, Spinner, Select, EmptyState } from '../components/ui';
import { fmtDateTime } from '../lib/format';

const ACTION_LABELS: Record<string, string> = {
  login: 'Вход', logout: 'Выход', change_password: 'Смена пароля',
  user_create: 'Создан пользователь', user_update: 'Изменён пользователь', user_reset_password: 'Сброс пароля',
  type_create: 'Создан тип', type_update: 'Изменён тип', type_delete: 'Удалён тип',
  template_create: 'Создан шаблон', template_update: 'Изменён шаблон', template_delete: 'Удалён шаблон',
  project_create: 'Создан проект', project_update: 'Изменён проект', project_delete: 'Удалён проект',
  access_grant: 'Выдан доступ', access_revoke: 'Отозван доступ',
  stage_create: 'Создан этап', stage_update: 'Изменён этап', stage_delete: 'Удалён этап',
  checklist_create: 'Создан пункт', checklist_update: 'Изменён пункт', checklist_delete: 'Удалён пункт',
  checklist_submit_review: 'Отправлен на приёмку', checklist_accept: 'Принят (РП)',
  checklist_pmo_accept: 'Принят (ПО)', checklist_reject: 'Возвращён на доработку',
  document_upload: 'Загружен файл', document_delete: 'Удалён файл',
  task_create: 'Создана задача', task_update: 'Изменена задача', task_delete: 'Удалена задача',
  milestone_create: 'Создана веха', milestone_update: 'Изменена веха', milestone_delete: 'Удалена веха',
  allocation_create: 'Добавлена загрузка', allocation_update: 'Изменена загрузка', allocation_delete: 'Удалена загрузка',
};

const ENTITY_TYPES = ['User', 'Project', 'ProjectAccess', 'ChecklistItem', 'Document', 'Task', 'Milestone', 'Allocation', 'ProjectType', 'ChecklistTemplate'];

export default function Audit() {
  const [entityType, setEntityType] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['audit', entityType],
    queryFn: async () => (await api.get<AuditEntry[]>(`/audit?limit=200${entityType ? `&entityType=${entityType}` : ''}`)).data,
  });

  return (
    <div>
      <PageHeader
        title="Аудит-лог"
        subtitle="Действия пользователей в системе"
        actions={
          <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-auto">
            <option value="">Все сущности</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : !data?.length ? (
        <EmptyState title="Записей нет" />
      ) : (
        <Card className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Время</th>
                <th className="px-4 py-3 font-medium">Пользователь</th>
                <th className="px-4 py-3 font-medium">Действие</th>
                <th className="px-4 py-3 font-medium">Сущность</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((e) => (
                <tr key={e.id} className="hover:bg-surface/60">
                  <td className="tnum whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDateTime(e.createdAt)}</td>
                  <td className="px-4 py-2.5 text-ink">{e.user?.fullName ?? '—'}<span className="ml-1 text-xs text-slate-400">{e.user?.login}</span></td>
                  <td className="px-4 py-2.5 text-slate-700">{ACTION_LABELS[e.action] ?? e.action}</td>
                  <td className="px-4 py-2.5 text-slate-400">{e.entityType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
