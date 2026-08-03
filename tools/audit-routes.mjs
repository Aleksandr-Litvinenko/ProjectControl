#!/usr/bin/env node
/**
 * Карта доступа к API, собранная из исходников.
 *
 * Идёт от apps/api/src/index.ts по всем app.use(...), спускается во вложенные
 * роутеры (например, вся админка примонтирована через routes/admin/index.ts)
 * и для каждого маршрута собирает охрану: requireAuth, requireRole(...),
 * assertAccess / assertWrite / canWriteProject и скоуп выборки
 * (projectScopeWhere / accessibleProjectIds). Охрана уровня роутера
 * наследуется вложенными.
 *
 * Печатает таблицу в Markdown и — главное — падает, если находит маршрут
 * вообще без охраны и его нет в списке заведомо публичных.
 *
 * Смысл в том, что таблицу прав нельзя поддерживать руками: она устаревает
 * на первом же новом эндпоинте. Здесь она каждый раз строится заново из кода.
 *
 *   node tools/audit-routes.mjs                              # таблица в stdout
 *   node tools/audit-routes.mjs --markdown docs/ACCESS-MAP.md # записать в файл
 *   node tools/audit-routes.mjs --quiet                       # только итог и проблемы
 *
 * Код возврата: 0 — незащищённых маршрутов нет, 1 — есть.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiSrc = join(root, 'apps/api/src');
const entryPath = join(apiSrc, 'index.ts');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];

/** Маршруты, которым положено быть публичными: вход и выход. */
const PUBLIC_ALLOWLIST = new Set([
  'POST /api/auth/login',
  'POST /api/auth/logout',
]);

const fileCache = new Map();

/** './routes/admin' -> абсолютный путь к .ts (с учётом index.ts в папке). */
function resolveModule(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Текст вызова целиком, начиная с открывающей скобки. */
function readCall(source, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return source.slice(openParenIndex, i + 1);
    }
  }
  return source.slice(openParenIndex);
}

/**
 * Режет файл на области верхнего уровня: имя объявления -> его текст.
 * Границами считаются объявления в начале строки и вызовы вида `router.get(`,
 * чтобы тело маршрута не приклеилось к предыдущей константе.
 */
function collectDeclarations(source) {
  const boundaryRe = new RegExp(
    String.raw`^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|class|interface|type)\s+(\w+)` +
      String.raw`|^\w+\.(?:use|${HTTP_METHODS.join('|')})\s*\(`,
    'gm',
  );

  const marks = [];
  for (const m of source.matchAll(boundaryRe)) {
    marks.push({ name: m[1] ?? null, index: m.index });
  }

  const declarations = new Map();
  for (let i = 0; i < marks.length; i++) {
    if (!marks[i].name) continue;
    const end = i + 1 < marks.length ? marks[i + 1].index : source.length;
    declarations.set(marks[i].name, source.slice(marks[i].index, end));
  }
  return declarations;
}

function guardsIn(text) {
  const guards = [];
  if (/\brequireAuth\b/.test(text)) guards.push('auth');
  for (const m of text.matchAll(/requireRole\(([^)]*)\)/g)) {
    for (const role of m[1].matchAll(/'([^']+)'/g)) guards.push(`role:${role[1]}`);
  }
  if (/\bassertWrite\b|\bcanWriteProject\b/.test(text)) guards.push('write');
  if (/\bassertAccess\b|\bcanAccessProject\b/.test(text)) guards.push('member');
  if (/\bprojectScopeWhere\b|\baccessibleProjectIds\b/.test(text)) guards.push('scoped');
  return guards;
}

/**
 * Разбирает файл: какие роутеры в нём объявлены, что они экспортируют,
 * какая у них охрана, какие маршруты и какие подроутеры примонтированы.
 */
function analyze(filePath) {
  if (fileCache.has(filePath)) return fileCache.get(filePath);

  const source = readFileSync(filePath, 'utf8');

  // Импорты: локальное имя -> абсолютный путь модуля.
  const imports = new Map();
  const importRe = /import\s+(?:(\w+)\s*(?:,\s*)?)?(?:\{([^}]*)\})?\s*from\s+'([^']+)'/g;
  for (const m of source.matchAll(importRe)) {
    const [, defaultName, named, specifier] = m;
    const target = resolveModule(filePath, specifier);
    if (!target) continue;
    if (defaultName) imports.set(defaultName, { file: target, exported: 'default' });
    for (const part of (named ?? '').split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      const original = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) imports.set(name, { file: target, exported: original || name });
    }
  }

  // Объявленные роутеры и их экспортные имена.
  const routers = new Map();
  for (const m of source.matchAll(/(?:const|export\s+const)\s+(\w+)\s*=\s*Router\(\)/g)) {
    routers.set(m[1], { guardCalls: [], routes: [], mounts: [] });
  }
  if (routers.size === 0) {
    const empty = { routers, exports: new Map(), imports, declarations: new Map() };
    fileCache.set(filePath, empty);
    return empty;
  }

  // Охрана не всегда видна в самом маршруте. Она может быть завёрнута
  // в именованную мидлварь рядом:
  //   const preAuthWrite = asyncHandler(async (req, _res, next) => { await assertWrite(...) });
  // или спрятана глубже — GET /api/dashboard зовёт buildDashboard, тот зовёт
  // scopedWhere, и только там accessibleProjectIds. Поэтому режем файл на
  // области верхнего уровня и считаем охрану по цепочке вызовов.
  const declarations = collectDeclarations(source);

  const exports = new Map(); // экспортное имя -> имя переменной роутера
  const defaultExport = source.match(/export\s+default\s+(\w+)\s*;/);
  if (defaultExport && routers.has(defaultExport[1])) exports.set('default', defaultExport[1]);
  for (const m of source.matchAll(/export\s+const\s+(\w+)\s*=\s*Router\(\)/g)) {
    exports.set(m[1], m[1]);
  }

  for (const [name, router] of routers) {
    // router.use(...) — охрана уровня роутера либо монтирование подроутера.
    for (const m of source.matchAll(new RegExp(`\\b${name}\\.use\\(`, 'g'))) {
      const call = readCall(source, m.index + m[0].length - 1);
      const mounted = call.match(/^\(\s*'([^']*)'\s*,\s*(\w+)\s*\)/);
      if (mounted) {
        router.mounts.push({ prefix: mounted[1], local: mounted[2] });
      } else {
        router.guardCalls.push(call);
      }
    }

    // router.get('/path', ...guards, handler)
    for (const m of source.matchAll(new RegExp(`\\b${name}\\.(${HTTP_METHODS.join('|')})\\(`, 'g'))) {
      const call = readCall(source, m.index + m[0].length - 1);
      const pathMatch = call.match(/^\(\s*'([^']*)'/);
      if (!pathMatch) continue;
      router.routes.push({
        method: m[1].toUpperCase(),
        path: pathMatch[1],
        call,
      });
    }
  }

  const parsed = { routers, exports, imports, declarations };
  fileCache.set(filePath, parsed);
  return parsed;
}

function joinPath(prefix, path) {
  const tail = path === '/' ? '' : path;
  return (prefix + tail).replace(/\/{2,}/g, '/') || '/';
}

/**
 * Охрана куска кода: то, что видно прямо в нём, плюс охрана всего, что он
 * зовёт — по цепочке, через границы файлов. Так находится и `preAuthWrite`
 * рядом с маршрутом, и `accessibleProjectIds` двумя вызовами глубже.
 */
function resolveCallGuards(filePath, text, seen = new Set(), depth = 0) {
  if (depth > 6) return [];
  const guards = guardsIn(text);
  const parsed = analyze(filePath);

  for (const m of text.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    const name = m[0];

    if (parsed.declarations.has(name)) {
      const key = `${filePath}#${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      guards.push(...resolveCallGuards(filePath, parsed.declarations.get(name), seen, depth + 1));
      continue;
    }

    const imported = parsed.imports.get(name);
    if (!imported) continue;
    const target = analyze(imported.file);
    const exportedName = imported.exported === 'default' ? null : imported.exported;
    if (!exportedName || !target.declarations.has(exportedName)) continue;
    const key = `${imported.file}#${exportedName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    guards.push(...resolveCallGuards(imported.file, target.declarations.get(exportedName), seen, depth + 1));
  }

  return guards;
}

/** Рекурсивно обходит роутер, накапливая префикс пути и унаследованную охрану. */
function walk(filePath, routerName, prefix, inherited, out, seen) {
  const key = `${filePath}#${routerName}#${prefix}`;
  if (seen.has(key)) return;
  seen.add(key);

  const parsed = analyze(filePath);
  const router = parsed.routers.get(routerName);
  if (!router) return;

  const guards = [...inherited];
  for (const call of router.guardCalls) {
    guards.push(...resolveCallGuards(filePath, call));
  }

  for (const route of router.routes) {
    out.push({
      file: relative(apiSrc, filePath),
      method: route.method,
      path: joinPath(prefix, route.path),
      guards: [...new Set([...guards, ...resolveCallGuards(filePath, route.call)])],
    });
  }

  for (const mount of router.mounts) {
    const imported = parsed.imports.get(mount.local);
    if (!imported) continue;
    const child = analyze(imported.file);
    const childRouter = child.exports.get(imported.exported);
    if (!childRouter) continue;
    walk(imported.file, childRouter, joinPath(prefix, mount.prefix), guards, out, seen);
  }
}

function collectRoutes() {
  const entry = analyze(entryPath);
  const source = readFileSync(entryPath, 'utf8');
  const out = [];
  const seen = new Set();

  for (const m of source.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
    const [, prefix, local] = m;
    const imported = entry.imports.get(local);
    if (!imported) continue;
    const child = analyze(imported.file);
    const routerName = child.exports.get(imported.exported);
    if (!routerName) continue;
    walk(imported.file, routerName, prefix, [], out, seen);
  }

  return out;
}

function describe(guards) {
  if (guards.length === 0) return '**без охраны**';
  const roles = guards.filter((g) => g.startsWith('role:')).map((g) => g.slice(5));
  const parts = [];
  if (roles.length) parts.push(`только ${[...new Set(roles)].join(' / ')}`);
  else if (guards.includes('auth')) parts.push('любой вошедший');
  if (guards.includes('write')) parts.push('право записи в проект');
  else if (guards.includes('member')) parts.push('доступ к проекту');
  if (guards.includes('scoped')) parts.push('выборка урезана по доступу');
  return parts.join(', ') || 'без проверки роли';
}

function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const mdIndex = args.indexOf('--markdown');
  const mdPath = mdIndex >= 0 ? args[mdIndex + 1] : null;

  const routes = collectRoutes();
  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const byFile = new Map();
  for (const route of routes) {
    if (!byFile.has(route.file)) byFile.set(route.file, []);
    byFile.get(route.file).push(route);
  }

  const lines = [
    '# Карта доступа к API',
    '',
    'Собрано автоматически из `apps/api/src`:',
    '`node tools/audit-routes.mjs --markdown docs/ACCESS-MAP.md`.',
    'Руками не правьте — файл перезаписывается целиком.',
    '',
    `Маршрутов: **${routes.length}**.`,
    '',
  ];

  for (const [file, list] of [...byFile].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## \`${file}\``, '', '| Метод | Путь | Кто может |', '|---|---|---|');
    for (const route of list) {
      lines.push(`| ${route.method} | \`${route.path}\` | ${describe(route.guards)} |`);
    }
    lines.push('');
  }

  lines.push(
    '---',
    '',
    '**Обозначения.**',
    '',
    '- «любой вошедший» — нужна сессия, роль не проверяется;',
    '- «доступ к проекту» — есть запись в `ProjectAccess` (у `pmo_admin` — всегда);',
    '- «право записи в проект» — `pmo_admin` либо назначенный РП именно этого проекта;',
    '- «выборка урезана по доступу» — список приходит уже отфильтрованным по доступным проектам.',
    '',
    'Охрана уровня роутера наследуется вложенными: например, вся админка закрыта',
    'одним `router.use(requireRole(\'pmo_admin\'))` в `routes/admin/index.ts`.',
    '',
  );

  const report = lines.join('\n');
  const unguarded = routes.filter(
    (r) => r.guards.length === 0 && !PUBLIC_ALLOWLIST.has(`${r.method} ${r.path}`),
  );

  if (mdPath) {
    const target = join(root, mdPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, report + '\n', 'utf8');
    console.log(`Записано: ${mdPath} — маршрутов ${routes.length}.`);
  } else if (!quiet) {
    console.log(report);
  }

  if (unguarded.length > 0) {
    console.error(`\nМаршруты без охраны (${unguarded.length}):`);
    for (const r of unguarded) console.error(`  ! ${r.method} ${r.path}   (${r.file})`);
    console.error('\nЕсли маршрут публичный намеренно — впишите его в PUBLIC_ALLOWLIST в tools/audit-routes.mjs.');
    process.exit(1);
  }

  if (quiet || mdPath) console.log(`Незащищённых маршрутов нет (проверено ${routes.length}).`);
  process.exit(0);
}

main();
