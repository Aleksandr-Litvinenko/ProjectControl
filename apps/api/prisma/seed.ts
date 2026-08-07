/**
 * ProjectControl — seed демо-данных.
 * Идемпотентно: пользователи/типы/шаблоны upsert-ятся; демо-проекты создаются
 * только если проектов ещё нет. Логины/пароли печатаются в конце.
 */
import {
  PrismaClient,
  Role,
  ProjectStatus,
  DocType,
  ChecklistStatus,
  StageStatus,
  TaskStatus,
  AccessRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requiredSeedSecret(name: 'SEED_ADMIN_PASSWORD' | 'SEED_DEMO_PASSWORD'): string {
  const value = process.env[name];
  if (!value || value.startsWith('CHANGE_ME') || value.length < 12) {
    throw new Error(`${name} must be set to a unique value with at least 12 characters`);
  }
  return value;
}

const ADMIN_PASSWORD = requiredSeedSecret('SEED_ADMIN_PASSWORD');
const DEMO_PASSWORD = requiredSeedSecret('SEED_DEMO_PASSWORD');

/** Дата со сдвигом в днях от «сейчас» (полдень) — чтобы статусы здоровья были осмысленными. */
function dnow(days: number, hour = 12): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

const BASE_ITEMS = [
  { title: 'Устав проекта', docType: DocType.charter, mandatory: true, requiresPmoApproval: true, stageHint: 1, defaultOrder: 1 },
  { title: 'Проектное решение', docType: DocType.project, mandatory: true, requiresPmoApproval: true, stageHint: 2, defaultOrder: 2 },
  { title: 'План проекта', docType: DocType.plan, mandatory: true, requiresPmoApproval: false, stageHint: 1, defaultOrder: 3 },
  { title: 'Техническое задание', docType: DocType.tz, mandatory: false, requiresPmoApproval: false, stageHint: 2, defaultOrder: 4 },
  { title: 'Коммерческое предложение', docType: DocType.kp, mandatory: false, requiresPmoApproval: false, stageHint: 1, defaultOrder: 5 },
  { title: 'Отчёт о внедрении', docType: DocType.report, mandatory: false, requiresPmoApproval: false, stageHint: 3, defaultOrder: 6 },
  { title: 'Протокол совещания', docType: DocType.protocol, mandatory: false, requiresPmoApproval: false, defaultOrder: 7 },
  { title: 'Регламент эксплуатации', docType: DocType.regulation, mandatory: false, requiresPmoApproval: false, stageHint: 3, defaultOrder: 8 },
];

const INTEGRATION_EXTRA = [
  { title: 'ТЗ на интеграцию', docType: DocType.tz, mandatory: false, requiresPmoApproval: false, stageHint: 2, defaultOrder: 9 },
  { title: 'Протокол моделирования', docType: DocType.protocol, mandatory: false, requiresPmoApproval: false, stageHint: 2, defaultOrder: 10 },
];

type Ids = Record<string, string>;

async function main() {
  console.log('▶ Seed: старт');

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── Типы проектов ──
  const typeDefs = [
    { name: 'Внедрение 1С:БП', description: 'Бухгалтерия предприятия' },
    { name: 'Внедрение 1С:ЗУП', description: 'Зарплата и управление персоналом' },
    { name: 'Внедрение 1С:УТ', description: 'Управление торговлей' },
    { name: 'Внедрение 1С:ERP', description: 'Комплексная автоматизация (ERP)' },
    { name: 'Интеграция / 1С:Шина / API', description: 'Интеграционные проекты' },
  ];
  const types: Ids = {};
  for (const t of typeDefs) {
    const pt = await prisma.projectType.upsert({
      where: { name: t.name },
      update: { description: t.description },
      create: t,
    });
    types[t.name] = pt.id;
  }

  // ── Шаблоны чек-листов (пересоздаём) ──
  await prisma.checklistTemplate.deleteMany({});
  for (const [name, id] of Object.entries(types)) {
    const isIntegration = name.startsWith('Интеграция');
    const items = isIntegration ? [...BASE_ITEMS, ...INTEGRATION_EXTRA] : BASE_ITEMS;
    await prisma.checklistTemplate.create({
      data: { projectTypeId: id, name: `Чек-лист: ${name}`, items: { create: items } },
    });
  }

  // ── Пользователи ──
  const userDefs = [
    { login: 'admin', fullName: 'Гордеева Ольга Викторовна', role: Role.pmo_admin, email: 'admin@projectcrm.ru', hash: adminHash },
    { login: 'pm1', fullName: 'Иванова Мария Петровна', role: Role.pm, email: 'pm1@projectcrm.ru', hash: demoHash },
    { login: 'pm2', fullName: 'Петров Сергей Алексеевич', role: Role.pm, email: 'pm2@projectcrm.ru', hash: demoHash },
    { login: 'pm3', fullName: 'Сидорова Анна Дмитриевна', role: Role.pm, email: 'pm3@projectcrm.ru', hash: demoHash },
    { login: 'spec1', fullName: 'Кузнецов Илья Романович', role: Role.specialist, email: 'spec1@projectcrm.ru', hash: demoHash },
    { login: 'spec2', fullName: 'Морозова Елена Сергеевна', role: Role.specialist, email: 'spec2@projectcrm.ru', hash: demoHash },
    { login: 'spec3', fullName: 'Волков Дмитрий Игоревич', role: Role.specialist, email: 'spec3@projectcrm.ru', hash: demoHash },
    { login: 'spec4', fullName: 'Новикова Татьяна Олеговна', role: Role.specialist, email: 'spec4@projectcrm.ru', hash: demoHash },
    { login: 'spec5', fullName: 'Зайцев Артём Владимирович', role: Role.specialist, email: 'spec5@projectcrm.ru', hash: demoHash },
    { login: 'obs1', fullName: 'Фёдоров Павел (наблюдатель)', role: Role.observer, email: 'obs1@projectcrm.ru', hash: demoHash },
    { login: 'obs2', fullName: 'Лебедева Ирина (наблюдатель)', role: Role.observer, email: 'obs2@projectcrm.ru', hash: demoHash },
    { login: 'client1', fullName: 'Заказчик: ООО «Север»', role: Role.client, email: 'client1@projectcrm.ru', hash: demoHash },
    { login: 'client2', fullName: 'Заказчик: АО «Вектор»', role: Role.client, email: 'client2@projectcrm.ru', hash: demoHash },
  ];
  const users: Ids = {};
  for (const u of userDefs) {
    const created = await prisma.user.upsert({
      where: { login: u.login },
      update: { fullName: u.fullName, role: u.role, email: u.email, passwordHash: u.hash, isActive: true },
      create: { login: u.login, fullName: u.fullName, role: u.role, email: u.email, passwordHash: u.hash },
    });
    users[u.login] = created.id;
  }

  // ── Демо-проекты (только если их ещё нет) ──
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`▶ Проекты уже есть (${existing}) — демо-проекты не создаю.`);
  } else {
    await createDemoProjects(types, users);
    console.log('▶ Демо-проекты созданы.');
  }

  console.log('✔ Seed завершён.');
  printCreds();
}

interface StageDef { name: string; order: number; startDate?: Date; endDate?: Date; status: StageStatus }
interface ItemDef {
  title: string; docType: DocType; mandatory: boolean; status: ChecklistStatus;
  deadline?: Date; requiresPmoApproval?: boolean; stageIndex?: number;
  responsibleLogin?: string; acceptedByLogin?: string; acceptedAt?: Date; order: number;
}
interface TaskDef { title: string; assigneeLogin?: string; startDate?: Date; endDate?: Date; progressPercent: number; status: TaskStatus; stageIndex?: number }
interface MilestoneDef { title: string; date: Date; reached: boolean }
interface AllocDef { login: string; periodStart: Date; periodEnd: Date; hoursPerDay: number; occupancyPercent: number }
interface AccessDef { login: string; accessRole: AccessRole }
interface ProjDef {
  title: string; client: string; typeName: string; description: string;
  status: ProjectStatus; startDate?: Date; plannedEndDate?: Date; actualEndDate?: Date; pmLogin: string;
  stages: StageDef[]; items: ItemDef[]; tasks: TaskDef[]; milestones: MilestoneDef[];
  allocations: AllocDef[]; access: AccessDef[];
}

async function makeProject(p: ProjDef, types: Ids, users: Ids) {
  const project = await prisma.project.create({
    data: {
      title: p.title, client: p.client, projectTypeId: types[p.typeName], description: p.description,
      status: p.status, startDate: p.startDate, plannedEndDate: p.plannedEndDate, actualEndDate: p.actualEndDate,
      createdById: users['admin'], pmUserId: users[p.pmLogin],
    },
  });

  const stageIds: string[] = [];
  for (const s of p.stages) {
    const st = await prisma.stage.create({
      data: { projectId: project.id, name: s.name, order: s.order, startDate: s.startDate, endDate: s.endDate, status: s.status },
    });
    stageIds.push(st.id);
  }

  for (const it of p.items) {
    await prisma.checklistItem.create({
      data: {
        projectId: project.id,
        stageId: it.stageIndex != null ? stageIds[it.stageIndex] : null,
        title: it.title, docType: it.docType, mandatory: it.mandatory, status: it.status,
        deadline: it.deadline, requiresPmoApproval: it.requiresPmoApproval ?? false,
        responsibleUserId: it.responsibleLogin ? users[it.responsibleLogin] : null,
        acceptedById: it.acceptedByLogin ? users[it.acceptedByLogin] : null,
        acceptedAt: it.acceptedAt, order: it.order,
      },
    });
  }

  for (const t of p.tasks) {
    await prisma.task.create({
      data: {
        projectId: project.id,
        stageId: t.stageIndex != null ? stageIds[t.stageIndex] : null,
        title: t.title, assigneeUserId: t.assigneeLogin ? users[t.assigneeLogin] : null,
        startDate: t.startDate, endDate: t.endDate, progressPercent: t.progressPercent, status: t.status,
      },
    });
  }

  for (const m of p.milestones) {
    await prisma.milestone.create({ data: { projectId: project.id, title: m.title, date: m.date, reached: m.reached } });
  }

  for (const a of p.allocations) {
    await prisma.allocation.create({
      data: { projectId: project.id, userId: users[a.login], periodStart: a.periodStart, periodEnd: a.periodEnd, hoursPerDay: a.hoursPerDay, occupancyPercent: a.occupancyPercent },
    });
  }

  const accessAll: AccessDef[] = [{ login: p.pmLogin, accessRole: AccessRole.pm }, ...p.access];
  for (const ac of accessAll) {
    await prisma.projectAccess.upsert({
      where: { projectId_userId: { projectId: project.id, userId: users[ac.login] } },
      update: { accessRole: ac.accessRole },
      create: { projectId: project.id, userId: users[ac.login], accessRole: ac.accessRole },
    });
  }
  return project;
}

async function createDemoProjects(types: Ids, users: Ids) {
  // P1 — ERP, активный, ПРОСРОЧЕН обязательный «План» (🔴) + перегруз spec1
  await makeProject({
    title: 'Внедрение 1С:ERP в ООО «Север»',
    client: 'ООО «Север»', typeName: 'Внедрение 1С:ERP',
    description: 'Комплексная автоматизация производства и финансов.',
    status: ProjectStatus.active, startDate: dnow(-60), plannedEndDate: dnow(30), pmLogin: 'pm1',
    stages: [
      { name: 'Обследование', order: 1, startDate: dnow(-60), endDate: dnow(-40), status: StageStatus.done },
      { name: 'Моделирование', order: 2, startDate: dnow(-40), endDate: dnow(5), status: StageStatus.active },
      { name: 'Внедрение', order: 3, startDate: dnow(5), endDate: dnow(30), status: StageStatus.planned },
    ],
    items: [
      { title: 'Устав проекта', docType: DocType.charter, mandatory: true, requiresPmoApproval: true, status: ChecklistStatus.accepted, stageIndex: 0, acceptedByLogin: 'admin', acceptedAt: dnow(-50), responsibleLogin: 'pm1', order: 1 },
      { title: 'Проектное решение', docType: DocType.project, mandatory: true, requiresPmoApproval: true, status: ChecklistStatus.in_review, deadline: dnow(5), stageIndex: 1, responsibleLogin: 'pm1', order: 2 },
      { title: 'План проекта', docType: DocType.plan, mandatory: true, requiresPmoApproval: false, status: ChecklistStatus.in_progress, deadline: dnow(-4), stageIndex: 0, responsibleLogin: 'pm1', order: 3 },
      { title: 'Техническое задание', docType: DocType.tz, mandatory: false, status: ChecklistStatus.in_progress, deadline: dnow(12), stageIndex: 1, responsibleLogin: 'spec1', order: 4 },
      { title: 'Коммерческое предложение', docType: DocType.kp, mandatory: false, status: ChecklistStatus.accepted, stageIndex: 0, acceptedByLogin: 'pm1', acceptedAt: dnow(-55), order: 5 },
      { title: 'Отчёт о внедрении', docType: DocType.report, mandatory: false, status: ChecklistStatus.not_started, stageIndex: 2, order: 6 },
    ],
    tasks: [
      { title: 'Сбор требований', stageIndex: 0, assigneeLogin: 'spec1', startDate: dnow(-60), endDate: dnow(-42), progressPercent: 100, status: TaskStatus.done },
      { title: 'Настройка подсистем', stageIndex: 1, assigneeLogin: 'spec1', startDate: dnow(-38), endDate: dnow(2), progressPercent: 45, status: TaskStatus.in_progress },
      { title: 'Миграция данных', stageIndex: 1, assigneeLogin: 'spec2', startDate: dnow(-30), endDate: dnow(8), progressPercent: 30, status: TaskStatus.in_progress },
      { title: 'Обучение пользователей', stageIndex: 2, assigneeLogin: 'spec2', startDate: dnow(6), endDate: dnow(28), progressPercent: 0, status: TaskStatus.not_started },
    ],
    milestones: [
      { title: 'Старт проекта', date: dnow(-60), reached: true },
      { title: 'Запуск опытной эксплуатации', date: dnow(20), reached: false },
    ],
    allocations: [
      { login: 'spec1', periodStart: dnow(-3), periodEnd: dnow(4), hoursPerDay: 7.2, occupancyPercent: 90 },
      { login: 'spec2', periodStart: dnow(-3), periodEnd: dnow(4), hoursPerDay: 4.8, occupancyPercent: 60 },
    ],
    access: [
      { login: 'spec1', accessRole: AccessRole.specialist },
      { login: 'spec2', accessRole: AccessRole.specialist },
      { login: 'obs1', accessRole: AccessRole.observer },
      { login: 'client1', accessRole: AccessRole.client },
    ],
  }, types, users);

  // P2 — ЗУП, активный, дедлайн обязательного «План» скоро (🟡)
  await makeProject({
    title: 'Внедрение 1С:ЗУП в АО «Вектор»',
    client: 'АО «Вектор»', typeName: 'Внедрение 1С:ЗУП',
    description: 'Автоматизация кадрового учёта и расчёта зарплаты.',
    status: ProjectStatus.active, startDate: dnow(-20), plannedEndDate: dnow(50), pmLogin: 'pm2',
    stages: [
      { name: 'Обследование', order: 1, startDate: dnow(-20), endDate: dnow(10), status: StageStatus.active },
      { name: 'Настройка', order: 2, startDate: dnow(10), endDate: dnow(35), status: StageStatus.planned },
      { name: 'Запуск', order: 3, startDate: dnow(35), endDate: dnow(50), status: StageStatus.planned },
    ],
    items: [
      { title: 'Устав проекта', docType: DocType.charter, mandatory: true, requiresPmoApproval: true, status: ChecklistStatus.accepted, stageIndex: 0, acceptedByLogin: 'admin', acceptedAt: dnow(-15), responsibleLogin: 'pm2', order: 1 },
      { title: 'План проекта', docType: DocType.plan, mandatory: true, requiresPmoApproval: false, status: ChecklistStatus.in_progress, deadline: dnow(6), stageIndex: 0, responsibleLogin: 'pm2', order: 2 },
      { title: 'Проектное решение', docType: DocType.project, mandatory: true, requiresPmoApproval: true, status: ChecklistStatus.not_started, deadline: dnow(25), stageIndex: 1, order: 3 },
      { title: 'Техническое задание', docType: DocType.tz, mandatory: false, status: ChecklistStatus.not_started, stageIndex: 1, order: 4 },
      { title: 'Коммерческое предложение', docType: DocType.kp, mandatory: false, status: ChecklistStatus.accepted, acceptedByLogin: 'pm2', acceptedAt: dnow(-18), order: 5 },
    ],
    tasks: [
      { title: 'Обследование процессов', stageIndex: 0, assigneeLogin: 'spec3', startDate: dnow(-20), endDate: dnow(8), progressPercent: 60, status: TaskStatus.in_progress },
      { title: 'Настройка расчёта зарплаты', stageIndex: 1, assigneeLogin: 'spec3', startDate: dnow(10), endDate: dnow(34), progressPercent: 10, status: TaskStatus.in_progress },
    ],
    milestones: [{ title: 'Завершение обследования', date: dnow(10), reached: false }],
    allocations: [{ login: 'spec3', periodStart: dnow(-3), periodEnd: dnow(4), hoursPerDay: 6.4, occupancyPercent: 80 }],
    access: [
      { login: 'spec3', accessRole: AccessRole.specialist },
      { login: 'obs2', accessRole: AccessRole.observer },
      { login: 'client2', accessRole: AccessRole.client },
    ],
  }, types, users);

  // P3 — БП, в плане, всё впереди (🟢)
  await makeProject({
    title: 'Внедрение 1С:БП в ИП Кузнецов',
    client: 'ИП Кузнецов А.А.', typeName: 'Внедрение 1С:БП',
    description: 'Постановка бухгалтерского и налогового учёта.',
    status: ProjectStatus.planned, startDate: dnow(5), plannedEndDate: dnow(60), pmLogin: 'pm3',
    stages: [{ name: 'Подготовка', order: 1, startDate: dnow(5), endDate: dnow(20), status: StageStatus.planned }],
    items: [
      { title: 'Устав проекта', docType: DocType.charter, mandatory: true, requiresPmoApproval: true, status: ChecklistStatus.not_started, stageIndex: 0, order: 1 },
      { title: 'План проекта', docType: DocType.plan, mandatory: true, requiresPmoApproval: false, status: ChecklistStatus.not_started, stageIndex: 0, order: 2 },
      { title: 'Проектное решение', docType: DocType.project, mandatory: true, requiresPmoApproval: true, status: ChecklistStatus.not_started, order: 3 },
    ],
    tasks: [],
    milestones: [{ title: 'Кик-офф', date: dnow(5), reached: false }],
    allocations: [],
    access: [{ login: 'spec4', accessRole: AccessRole.specialist }],
  }, types, users);

  // P4 — Интеграция, активный, ПРОСРОЧЕН срок проекта (🔴) + spec1 перегруз (с P1)
  await makeProject({
    title: 'Интеграция 1С:Шина для «ТехноЛогистика»',
    client: 'ООО «ТехноЛогистика»', typeName: 'Интеграция / 1С:Шина / API',
    description: 'Обмен данными между 1С:ERP и WMS через 1С:Шину.',
    status: ProjectStatus.active, startDate: dnow(-90), plannedEndDate: dnow(-3), pmLogin: 'pm1',
    stages: [
      { name: 'Анализ систем', order: 1, startDate: dnow(-90), endDate: dnow(-60), status: StageStatus.done },
      { name: 'Разработка интеграции', order: 2, startDate: dnow(-60), endDate: dnow(-3), status: StageStatus.active },
      { name: 'Тестирование', order: 3, startDate: dnow(-15), endDate: dnow(5), status: StageStatus.active },
    ],
    items: [
      { title: 'Устав проекта', docType: DocType.charter, mandatory: true, requiresPmoApproval: true, status: ChecklistStatus.accepted, stageIndex: 0, acceptedByLogin: 'admin', acceptedAt: dnow(-80), order: 1 },
      { title: 'Проектное решение', docType: DocType.project, mandatory: true, requiresPmoApproval: true, status: ChecklistStatus.accepted, stageIndex: 1, acceptedByLogin: 'admin', acceptedAt: dnow(-55), order: 2 },
      { title: 'План проекта', docType: DocType.plan, mandatory: true, requiresPmoApproval: false, status: ChecklistStatus.accepted, stageIndex: 0, acceptedByLogin: 'pm1', acceptedAt: dnow(-78), order: 3 },
      { title: 'ТЗ на интеграцию', docType: DocType.tz, mandatory: false, status: ChecklistStatus.in_progress, deadline: dnow(2), stageIndex: 1, responsibleLogin: 'spec5', order: 4 },
      { title: 'Протокол моделирования', docType: DocType.protocol, mandatory: false, status: ChecklistStatus.ready, stageIndex: 1, responsibleLogin: 'spec1', order: 5 },
    ],
    tasks: [
      { title: 'Анализ систем-источников', stageIndex: 0, assigneeLogin: 'spec5', startDate: dnow(-90), endDate: dnow(-62), progressPercent: 100, status: TaskStatus.done },
      { title: 'Разработка коннектора 1С:Шина', stageIndex: 1, assigneeLogin: 'spec1', startDate: dnow(-55), endDate: dnow(-5), progressPercent: 80, status: TaskStatus.in_progress },
      { title: 'Тестирование обмена', stageIndex: 2, assigneeLogin: 'spec5', startDate: dnow(-15), endDate: dnow(5), progressPercent: 50, status: TaskStatus.in_progress },
    ],
    milestones: [
      { title: 'MVP интеграции', date: dnow(-10), reached: true },
      { title: 'Приёмо-сдаточные испытания', date: dnow(-1), reached: false },
    ],
    allocations: [
      { login: 'spec1', periodStart: dnow(-3), periodEnd: dnow(4), hoursPerDay: 4.0, occupancyPercent: 50 },
      { login: 'spec5', periodStart: dnow(-3), periodEnd: dnow(4), hoursPerDay: 5.6, occupancyPercent: 70 },
    ],
    access: [
      { login: 'spec1', accessRole: AccessRole.specialist },
      { login: 'spec5', accessRole: AccessRole.specialist },
      { login: 'obs1', accessRole: AccessRole.observer },
    ],
  }, types, users);
}

function printCreds() {
  console.log('\n──────── Демо-пользователи созданы ────────');
  console.log('  admin — Руководитель ПО (pmo_admin)');
  console.log('  pm1, pm2, pm3 — Руководители проектов');
  console.log('  spec1 … spec5 — Специалисты');
  console.log('  obs1, obs2 — Наблюдатели');
  console.log('  client1, client2 — Заказчики');
  console.log('  Пароли взяты из SEED_ADMIN_PASSWORD и SEED_DEMO_PASSWORD и не выводятся.');
  console.log('───────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('✖ Seed ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
