export type Role = 'pmo_admin' | 'pm' | 'specialist' | 'observer' | 'client';
export type AccessRole = 'pm' | 'specialist' | 'observer' | 'client';
export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'done' | 'cancelled';
export type StageStatus = 'planned' | 'active' | 'done';
export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'blocked';
export type ChecklistStatus = 'not_started' | 'in_progress' | 'ready' | 'in_review' | 'accepted' | 'overdue';
export type DocType = 'charter' | 'project' | 'plan' | 'tz' | 'kp' | 'report' | 'protocol' | 'regulation' | 'other';
export type Health = 'ok' | 'warn' | 'risk';

export interface CurrentUser {
  id: string;
  login: string;
  fullName: string;
  role: Role;
}

export interface UserRow extends CurrentUser {
  email: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { access: number; managedProjects: number };
}

export interface ProjectType {
  id: string;
  name: string;
  description: string | null;
  _count?: { projects: number; templates: number };
}

export interface ProjectListItem {
  id: string;
  title: string;
  client: string;
  status: ProjectStatus;
  projectType: { id: string; name: string } | null;
  pm: { id: string; fullName: string } | null;
  startDate: string | null;
  plannedEndDate: string | null;
  actualEndDate: string | null;
  _count?: { checklist: number; tasks: number; stages: number };
}

export interface DocFill {
  acceptedAll: number; totalAll: number; ratioAll: number;
  acceptedMand: number; totalMand: number; ratioMand: number;
}
export interface Forecast {
  elapsedRatio: number; expectedPercent: number; actualPercent: number; deltaDays: number; behind: boolean;
}

export interface DashboardRow {
  id: string; title: string; client: string;
  projectType: { id: string; name: string } | null;
  pm: { id: string; fullName: string } | null;
  status: ProjectStatus;
  startDate: string | null; plannedEndDate: string | null; actualEndDate: string | null;
  progress: number; health: Health;
  doc: DocFill; forecast: Forecast;
  overdueMandatoryCount: number;
}

export interface DashboardSummary {
  totalProjects: number; activeProjects: number; docFillPortfolio: number;
  projectsAtRisk: number; riskRed: number; riskYellow: number;
  overdueChecklistItems: number; overloadedSpecialists: number;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  rows: DashboardRow[];
}

export interface Stage {
  id: string; projectId: string; name: string; order: number;
  startDate: string | null; endDate: string | null; status: StageStatus;
}

export interface DocumentItem {
  id: string; originalName: string; version: number; mimeType: string;
  sizeBytes: number; uploadedAt: string; uploadedBy: { id: string; fullName: string };
}

export interface ChecklistItem {
  id: string; projectId: string; stageId: string | null;
  title: string; docType: DocType; mandatory: boolean; status: ChecklistStatus;
  deadline: string | null; requiresPmoApproval: boolean;
  responsibleUserId: string | null;
  responsible: { id: string; fullName: string } | null;
  acceptedBy: { id: string; fullName: string } | null; acceptedAt: string | null;
  order: number; internalNote?: string | null;
  documents: DocumentItem[];
}

export interface Task {
  id: string; projectId: string; stageId: string | null; title: string;
  assigneeUserId: string | null; assignee: { id: string; fullName: string } | null;
  startDate: string | null; endDate: string | null; progressPercent: number; status: TaskStatus;
}

export interface Milestone {
  id: string; projectId: string; title: string; date: string; reached: boolean;
}

export interface Allocation {
  id: string; projectId: string; userId: string;
  user: { id: string; fullName: string };
  periodStart: string; periodEnd: string; hoursPerDay: number; occupancyPercent: number;
}

export interface AccessEntry {
  id: string; projectId: string; userId: string; accessRole: AccessRole;
  user: { id: string; fullName: string; login: string; role: Role };
}

export interface ProjectDetail {
  id: string; title: string; client: string; description: string | null;
  status: ProjectStatus;
  startDate: string | null; plannedEndDate: string | null; actualEndDate: string | null;
  projectType: { id: string; name: string } | null;
  pm: { id: string; fullName: string; login: string } | null;
  createdBy: { id: string; fullName: string } | null;
  pmUserId: string | null;
  stages: Stage[];
  checklist: ChecklistItem[];
  tasks: Task[];
  milestones: Milestone[];
  allocations: Allocation[];
  access: AccessEntry[];
}

export interface AllocCell { weekStart: string; occupancyPercent: number; level: Health }
export interface AllocSummaryRow {
  user: { id: string; fullName: string };
  cells: AllocCell[];
  maxOccupancy: number;
  overloaded: boolean;
}
export interface AllocSummary {
  weeks: string[];
  thresholds: { yellow: number; red: number };
  rows: AllocSummaryRow[];
}

export interface AuditEntry {
  id: string; action: string; entityType: string; entityId: string | null;
  payload: unknown; createdAt: string;
  user: { id: string; fullName: string; login: string } | null;
}

export interface ChecklistTemplate {
  id: string; name: string; projectType: { id: string; name: string };
  items: TemplateItem[];
}
export interface TemplateItem {
  id?: string; title: string; docType: DocType; mandatory: boolean;
  requiresPmoApproval: boolean; stageHint: number | null; defaultOrder: number;
}
