import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_BRAND_LOGO_SRC,
  PDF_REPORT_THEME,
  drawOfficialPdfFooter,
  drawPdfHorizontalRule,
  drawPdfImage,
  loadPdfImage,
} from './gameReportPdf';
import {
  buildTeamStatsReportModel,
  type BuildTeamStatsReportModelInput,
  type TeamStatsReportModel,
} from '../utils/teamStatsReportModel';
import {
  TEAM_STATS_PDF_GLOSSARY_NOTE,
  getTeamStatsPdfGlossaryEntries,
} from '../utils/playerStatsGlossary';

const PAGE_TITLE = 'Player Stats';
const TABLE_FONT_SIZE = 7;
const TABLE_CELL_PADDING = 1.8;
const PAGE_MARGIN = 28;
const SECTION_GAP = 14;
const SECTION_TITLE_FONT_SIZE = 12;
const LEGEND_TITLE = 'Legend';
const LEGEND_COLUMNS = 3;
const FOOTER_CLEARANCE = 36;

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

function getPageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
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

async function drawReportHeader(
  doc: jsPDF,
  model: TeamStatsReportModel
): Promise<number> {
  const pageWidth = getPageWidth(doc);
  const logoSize = 26;
  let y = 18;

  const [brand, teamIcon] = await Promise.all([
    loadPdfImage(PDF_BRAND_LOGO_SRC),
    loadPdfImage(model.teamIcon),
  ]);
  drawPdfImage(doc, brand, PAGE_MARGIN, y - 4, logoSize, logoSize);
  drawPdfImage(
    doc,
    teamIcon,
    pageWidth - PAGE_MARGIN - logoSize,
    y - 4,
    logoSize,
    logoSize
  );

  doc.setTextColor(...PDF_REPORT_THEME.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(model.teamName, pageWidth / 2, y + 8, { align: 'center' });
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(PAGE_TITLE, pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(7);
  doc.setTextColor(...PDF_REPORT_THEME.navyMuted);
  doc.text(
    `${model.tournamentScopeLabel}  ·  ${model.formatScopeLabel}  ·  ${model.playerCount} players  ·  Sorted by PPG`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 10;
  drawPdfHorizontalRule(doc, y, PAGE_MARGIN);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF_REPORT_THEME.navyMuted);

  if (model.shotDataCoverage?.isPartial) {
    doc.text(
      `PITP/FB PTS averages use games with shot chart data (${model.shotDataCoverage.gamesWithShotData} of ${model.shotDataCoverage.gamesTotal}).`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 9;
  }

  if (model.plusMinusCoverage?.isPartial) {
    doc.text(
      `+/- average uses games that recorded +/- (${model.plusMinusCoverage.gamesWithData} of ${model.plusMinusCoverage.gamesTotal}).`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 9;
  }

  if (model.foulsDrawnCoverage?.isPartial) {
    doc.text(
      `FDPG average uses games that recorded fouls drawn (${model.foulsDrawnCoverage.gamesWithData} of ${model.foulsDrawnCoverage.gamesTotal}).`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 9;
  }

  if (model.personalFoulsCoverage?.isPartial) {
    doc.text(
      `FPG average uses games that recorded personal fouls (${model.personalFoulsCoverage.gamesWithData} of ${model.personalFoulsCoverage.gamesTotal}).`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 9;
  }

  doc.setTextColor(0, 0, 0);
  return y + 6;
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
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  doc.text(sectionTitle, pageWidth / 2, startY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: startY + 10,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: FOOTER_CLEARANCE },
    tableWidth: pageWidth - PAGE_MARGIN * 2,
    head: [headers],
    body,
    showHead: 'everyPage',
    theme: 'grid',
    styles: {
      fontSize: TABLE_FONT_SIZE,
      cellPadding: TABLE_CELL_PADDING,
      halign: 'center',
      overflow: 'ellipsize',
      lineColor: PDF_REPORT_THEME.rule,
      lineWidth: 0.35,
      textColor: [20, 20, 20],
    },
    headStyles: {
      fillColor: PDF_REPORT_THEME.navy,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: TABLE_FONT_SIZE,
      halign: 'center',
    },
    columnStyles: buildStatsTableColumnStyles(pageWidth, statColumnCount),
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
  doc.setTextColor(...PDF_REPORT_THEME.navy);
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

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= getPageHeight(doc) - FOOTER_CLEARANCE) return y;
  doc.addPage('letter', 'landscape');
  return 36;
}

export async function generateTeamStatsReportPdf(
  model: TeamStatsReportModel
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  });

  let y = await drawReportHeader(doc, model);

  y = drawStatsTableSection(
    doc,
    y,
    'Standard',
    model.standardHeaders,
    model.standardBody
  );

  y = ensureSpace(doc, y + SECTION_GAP, 80);
  y = drawStatsTableSection(
    doc,
    y,
    'Advanced',
    model.advancedHeaders,
    model.advancedBody
  );

  y = ensureSpace(doc, y + SECTION_GAP, 90);
  drawLegendSection(doc, y);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawOfficialPdfFooter(doc, page, totalPages, PAGE_MARGIN);
  }

  return doc.output('blob');
}

export async function downloadTeamStatsReportPdf(
  input: BuildTeamStatsReportModelInput
): Promise<void> {
  const model = buildTeamStatsReportModel(input);
  const blob = await generateTeamStatsReportPdf(model);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = model.filename;
  link.click();
  URL.revokeObjectURL(url);
}
