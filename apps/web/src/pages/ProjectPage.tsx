import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject } from './project/useProject';
import { useAuth } from '../lib/auth';
import { Spinner, HealthPill, ProjectStatusPill, EmptyState } from '../components/ui';
import { OverviewTab } from './project/OverviewTab';
import { ChecklistTab } from './project/ChecklistTab';
import { TimelineTab } from './project/TimelineTab';
import { AllocationsTab } from './project/AllocationsTab';
import { TeamTab } from './project/TeamTab';
import { computeMetrics } from './project/metrics';

type Tab = 'overview' | 'checklist' | 'timeline' | 'allocations' | 'team';

export default function ProjectPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data: project, isLoading, isError } = useProject(id);
  const [tab, setTab] = useState<Tab>('overview');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;
  if (isError || !project) return <EmptyState title="Проект недоступен" hint="Возможно, у вас нет доступа" />;

  const isAdmin = user?.role === 'pmo_admin';
  const isClient = user?.role === 'client';
  // право записи: админ или РП этого проекта
  const canWrite = isAdmin || (user?.role === 'pm' && project.pmUserId === user.id);

  const m = computeMetrics(project);

  const tabs: { key: Tab; label: string; hidden?: boolean }[] = [
    { key: 'overview', label: 'Обзор' },
    { key: 'checklist', label: `Чек-лист (${project.checklist.length})` },
    { key: 'timeline', label: 'Сроки' },
    { key: 'allocations', label: 'Загрузка', hidden: isClient },
    { key: 'team', label: 'Команда' },
  ];

  return (
    <div>
      <div className="mb-2">
        <Link to="/projects" className="text-sm text-slate-400 hover:text-primary-600">← К проектам</Link>
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink sm:text-[28px]">{project.title}</h1>
          <p className="mt-1 text-slate-500">{project.client} · {project.projectType?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectStatusPill status={project.status} />
          <HealthPill health={m.health} />
        </div>
      </div>

      {/* Tabs */}
      <div className="thin-scroll mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.filter((t) => !t.hidden).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
              tab === t.key ? 'border-primary text-primary-600' : 'border-transparent text-slate-500 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'checklist' && <ChecklistTab project={project} canWrite={canWrite} />}
      {tab === 'timeline' && <TimelineTab project={project} canWrite={canWrite} />}
      {tab === 'allocations' && !isClient && <AllocationsTab project={project} canWrite={canWrite} />}
      {tab === 'team' && <TeamTab project={project} isAdmin={isAdmin} />}
    </div>
  );
}
