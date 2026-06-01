import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import fs from 'node:fs';
import { asyncHandler } from '../http';
import { requireAuth } from '../middleware/auth';
import { buildDashboard, type DashboardRow } from './dashboard';

const router = Router();
router.use(requireAuth);

const HEALTH_RU: Record<string, string> = { ok: 'В норме', warn: 'Внимание', risk: 'Риск' };
const STATUS_RU: Record<string, string> = {
  planned: 'Планируется', active: 'В работе', on_hold: 'Пауза', done: 'Завершён', cancelled: 'Отменён',
};
const fmtDate = (d: Date | null): string => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');

// ───────────────────────── Excel (xlsx) ─────────────────────────
router.get(
  '/dashboard.xlsx',
  asyncHandler(async (req, res) => {
    const { summary, rows } = await buildDashboard(req.user!, req.query as Record<string, unknown>);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ProjectControl';
    wb.created = new Date();

    // Лист сводки
    const s = wb.addWorksheet('Сводка');
    s.columns = [{ width: 38 }, { width: 16 }];
    s.addRow(['Портфель проектов — сводка', '']);
    s.getRow(1).font = { bold: true, size: 14 };
    s.addRow([]);
    const kpis: [string, number | string][] = [
      ['Всего проектов', summary.totalProjects],
      ['Активных проектов', summary.activeProjects],
      ['Заполненность документации, %', summary.docFillPortfolio],
      ['Проектов в риске (🔴/🟡)', summary.projectsAtRisk],
      ['  из них 🔴', summary.riskRed],
      ['  из них 🟡', summary.riskYellow],
      ['Просроченных пунктов', summary.overdueChecklistItems],
      ['Перегруженных специалистов', summary.overloadedSpecialists],
    ];
    kpis.forEach(([k, v]) => {
      const r = s.addRow([k, v]);
      r.getCell(1).font = { bold: true };
    });

    // Лист проектов
    const ws = wb.addWorksheet('Проекты');
    ws.columns = [
      { header: 'Проект', key: 'title', width: 36 },
      { header: 'Заказчик', key: 'client', width: 24 },
      { header: 'РП', key: 'pm', width: 24 },
      { header: 'Тип', key: 'type', width: 26 },
      { header: 'Статус', key: 'status', width: 14 },
      { header: 'Прогресс, %', key: 'progress', width: 13 },
      { header: 'Док. (принято/всего)', key: 'docs', width: 20 },
      { header: 'Обяз. (принято/всего)', key: 'mand', width: 20 },
      { header: 'Здоровье', key: 'health', width: 12 },
      { header: 'План. срок', key: 'planned', width: 14 },
      { header: 'Факт. срок', key: 'actual', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF0FF' } };

    rows.forEach((r: DashboardRow) => {
      ws.addRow({
        title: r.title,
        client: r.client,
        pm: r.pm?.fullName ?? '—',
        type: r.projectType?.name ?? '—',
        status: STATUS_RU[r.status] ?? r.status,
        progress: r.progress,
        docs: `${r.doc.acceptedAll}/${r.doc.totalAll}`,
        mand: `${r.doc.acceptedMand}/${r.doc.totalMand}`,
        health: HEALTH_RU[r.health] ?? r.health,
        planned: fmtDate(r.plannedEndDate),
        actual: fmtDate(r.actualEndDate),
      });
    });
    ws.autoFilter = { from: 'A1', to: 'K1' };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="portfolio.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }),
);

// ───────────────────────── PDF ─────────────────────────
// Кириллический шрифт (DejaVuSans) кладётся в src/assets и копируется в dist.
function resolveFont(): string | null {
  const candidates = [
    path.join(__dirname, '../assets/DejaVuSans.ttf'),
    path.join(process.cwd(), 'src/assets/DejaVuSans.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

router.get(
  '/dashboard.pdf',
  asyncHandler(async (req, res) => {
    const { summary, rows } = await buildDashboard(req.user!, req.query as Record<string, unknown>);
    const fontPath = resolveFont();

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    if (fontPath) {
      doc.registerFont('body', fontPath);
      doc.font('body');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="portfolio.pdf"');
    doc.pipe(res);

    doc.fontSize(18).text('ProjectControl — портфель проектов', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#555').text(`Сформировано: ${new Date().toLocaleString('ru-RU')}`);
    doc.moveDown(0.6);

    doc.fontSize(10).fillColor('#000').text(
      `Всего: ${summary.totalProjects}   ·   Активных: ${summary.activeProjects}   ·   ` +
        `Документация: ${summary.docFillPortfolio}%   ·   В риске: ${summary.projectsAtRisk} ` +
        `(🔴${summary.riskRed}/🟡${summary.riskYellow})   ·   Просрочено: ${summary.overdueChecklistItems}   ·   ` +
        `Перегружены: ${summary.overloadedSpecialists}`,
    );
    doc.moveDown(0.8);

    // Таблица
    const cols = [
      { label: 'Проект', w: 170 },
      { label: 'Заказчик', w: 110 },
      { label: 'РП', w: 110 },
      { label: 'Статус', w: 70 },
      { label: 'Прогр.', w: 45 },
      { label: 'Док.', w: 50 },
      { label: 'Обяз.', w: 50 },
      { label: 'Здоровье', w: 60 },
      { label: 'План', w: 60 },
    ];
    const startX = doc.x;
    let y = doc.y;
    const rowH = 18;

    const drawRow = (cells: string[], opts: { header?: boolean } = {}) => {
      let x = startX;
      if (opts.header) doc.rect(x, y, cols.reduce((a, c) => a + c.w, 0), rowH).fill('#EEF0FF').fillColor('#000');
      doc.fontSize(8.5).fillColor('#000');
      cells.forEach((txt, i) => {
        doc.text(txt, x + 3, y + 5, { width: cols[i].w - 6, ellipsis: true, lineBreak: false });
        x += cols[i].w;
      });
      y += rowH;
      doc.moveTo(startX, y).lineTo(startX + cols.reduce((a, c) => a + c.w, 0), y).strokeColor('#E6E8EC').stroke();
    };

    drawRow(cols.map((c) => c.label), { header: true });
    for (const r of rows) {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = doc.y;
        drawRow(cols.map((c) => c.label), { header: true });
      }
      drawRow([
        r.title,
        r.client,
        r.pm?.fullName ?? '—',
        STATUS_RU[r.status] ?? r.status,
        `${r.progress}%`,
        `${r.doc.acceptedAll}/${r.doc.totalAll}`,
        `${r.doc.acceptedMand}/${r.doc.totalMand}`,
        HEALTH_RU[r.health] ?? r.health,
        fmtDate(r.plannedEndDate),
      ]);
    }

    doc.end();
  }),
);

export default router;
