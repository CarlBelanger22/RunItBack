import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_REPORT_THEME } from './gameReportPdf';
import {
  buildTeamStatsReportModel,
  type BuildTeamStatsReportModelInput,
  type TeamStatsReportModel,
} from '../utils/teamStatsReportModel';
import {
  TEAM_STATS_PDF_GLOSSARY_NOTE,
  getTeamStatsPdfGlossaryEntries,
} from '../utils/playerStatsGlossary';

const PAGE_TITLE = 'PLAYER STATS';
const TABLE_FONT_SIZE = 7;
const TABLE_CELL_PADDING = 2;
const PAGE_MARGIN = 16;
const SECTION_GAP = 8;
const SECTION_TITLE_FONT_SIZE = 9;
const LEGEND_TITLE = 'Legend';
const LEGEND_COLUMNS = 3;

const COMMON_COLUMN_WIDTHS = {
  rank: 12,
  player: 64,
  position: 16,
  gamesPlayed: 14,
  mpg: 22,
} as const;

function getPageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}

function getLastTableBottom(doc: jsPDF): number | undefined {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY;
}

function buildStatsTableColumnStyles(
  pageWidth: number,
  statColumnCount: number
): Record<number, { cellWidth: number; halign: 'left' | 'center' }> {
  const tableWidth = pageWidth - PAGE_MARGIN * 2;
  const fixedTotal =
    COMMON_COLUMN_WIDTHS.rank +
    COMMON_COLUMN_WIDTHS.player +
    COMMON_COLUMN_WIDTHS.position +
    COMMON_COLUMN_WIDTHS.gamesPlayed +
    COMMON_COLUMN_WIDTHS.mpg;
  const statWidth = Math.max(14, (tableWidth - fixedTotal) / statColumnCount);

  const styles: Record<number, { cellWidth: number; halign: 'left' | 'center' }> =
    {
      0: { cellWidth: COMMON_COLUMN_WIDTHS.rank, halign: 'center' },
      1: { cellWidth: COMMON_COLUMN_WIDTHS.player, halign: 'left' },
      2: { cellWidth: COMMON_COLUMN_WIDTHS.position, halign: 'center' },
      3: { cellWidth: COMMON_COLUMN_WIDTHS.gamesPlayed, halign: 'center' },
      4: { cellWidth: COMMON_COLUMN_WIDTHS.mpg, halign: 'center' },
    };

  for (let index = 0; index < statColumnCount; index += 1) {
    styles[5 + index] = { cellWidth: statWidth, halign: 'center' };
  }

  return styles;
}

function drawReportHeader(doc: jsPDF, model: TeamStatsReportModel): number {
  const pageWidth = getPageWidth(doc);
  let y = 22;

  doc.setTextColor(...PDF_REPORT_THEME.titleBar);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(PAGE_TITLE, pageWidth / 2, y, { align: 'center' });
  y += 14;

  doc.setFontSize(10);
  doc.text(model.teamName, pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Tournaments: ${model.tournamentScopeLabel}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 9;
  doc.text(`Format: ${model.formatScopeLabel}`, pageWidth / 2, y, {
    align: 'center',
  });
  y += 9;
  doc.text(
    `${model.playerCount} players · Exported ${model.exportedAt}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 9;
  doc.text('Sorted by PPG (descending)', pageWidth / 2, y, { align: 'center' });
  y += 9;

  if (model.shotDataCoverage?.isPartial) {
    doc.text(
      `PITP/FB PTS averages use games with shot chart data (${model.shotDataCoverage.gamesWithShotData} of ${model.shotDataCoverage.gamesTotal}).`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 9;
  }

  doc.setTextColor(0, 0, 0);
  return y + 4;
}

function drawStatsTableSection(
  doc: jsPDF,
  startY: number,
  sectionTitle: string,
  headers: string[],
  body: string[][]
): number {
  const pageWidth = getPageWidth(doc);
  const statColumnCount = headers.length - 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(SECTION_TITLE_FONT_SIZE);
  doc.setTextColor(...PDF_REPORT_THEME.titleBar);
  doc.text(sectionTitle, pageWidth / 2, startY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: startY + 6,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    tableWidth: pageWidth - PAGE_MARGIN * 2,
    head: [headers],
    body,
    showHead: 'firstPage',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    theme: 'grid',
    styles: {
      fontSize: TABLE_FONT_SIZE,
      cellPadding: TABLE_CELL_PADDING,
      halign: 'center',
      overflow: 'linebreak',
      minCellHeight: 9,
    },
    headStyles: {
      fillColor: PDF_REPORT_THEME.titleBar,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: TABLE_FONT_SIZE,
      halign: 'center',
      cellPadding: TABLE_CELL_PADDING,
    },
    columnStyles: buildStatsTableColumnStyles(pageWidth, statColumnCount),
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  return getLastTableBottom(doc) ?? startY + 60;
}

function drawLegendSection(doc: jsPDF, startY: number): number {
  const pageWidth = getPageWidth(doc);
  const entries = getTeamStatsPdfGlossaryEntries();
  const columnGap = 14;
  const columnWidth =
    (pageWidth - PAGE_MARGIN * 2 - columnGap * (LEGEND_COLUMNS - 1)) /
    LEGEND_COLUMNS;
  const rowsPerColumn = Math.ceil(entries.length / LEGEND_COLUMNS);
  const lineHeight = 7.5;

  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(SECTION_TITLE_FONT_SIZE);
  doc.setTextColor(...PDF_REPORT_THEME.titleBar);
  doc.text(LEGEND_TITLE, pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(80, 80, 80);
  doc.text(TEAM_STATS_PDF_GLOSSARY_NOTE, pageWidth / 2, y, { align: 'center' });
  y += 9;
  doc.setTextColor(0, 0, 0);

  entries.forEach((entry, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    const x = PAGE_MARGIN + column * (columnWidth + columnGap);
    const lineY = y + row * lineHeight;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text(entry.abbrev, x, lineY);

    doc.setFont('helvetica', 'normal');
    const labelX = x + doc.getTextWidth(entry.abbrev) + 4;
    doc.text(entry.description, labelX, lineY, {
      maxWidth: columnWidth - (labelX - x),
    });
  });

  return y + rowsPerColumn * lineHeight + 4;
}

export function generateTeamStatsReportPdf(model: TeamStatsReportModel): Blob {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  });

  let y = drawReportHeader(doc, model);

  y = drawStatsTableSection(
    doc,
    y,
    'Standard',
    model.standardHeaders,
    model.standardBody
  );

  y = drawStatsTableSection(
    doc,
    y + SECTION_GAP,
    'Advanced',
    model.advancedHeaders,
    model.advancedBody
  );

  drawLegendSection(doc, y + SECTION_GAP);

  return doc.output('blob');
}

export function downloadTeamStatsReportPdf(
  input: BuildTeamStatsReportModelInput
): void {
  const model = buildTeamStatsReportModel(input);
  const blob = generateTeamStatsReportPdf(model);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = model.filename;
  link.click();
  URL.revokeObjectURL(url);
}
