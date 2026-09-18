import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Game, Tournament } from '../App';
import {
  buildGameReportModel,
  PDF_BOX_SCORE_HEADERS,
  LINEUP_STINTS_COMING_SOON_COPY,
  type GameReportBoxScoreRow,
  type GameReportComparisonRow,
  type GameReportExportOptions,
  type GameReportModel,
  DEFAULT_GAME_REPORT_EXPORT_OPTIONS,
} from '../utils/gameReportModel';
import { isTeamIconImage } from '../utils/teamIcon';

/** Official navy / white report theme (G4 / G6). */
export const PDF_REPORT_THEME = {
  navy: [20, 48, 82] as [number, number, number],
  navyMuted: [70, 90, 115] as [number, number, number],
  rule: [180, 188, 198] as [number, number, number],
  winnerFill: [232, 238, 245] as [number, number, number],
  totalsFill: [32, 58, 92] as [number, number, number],
  /** @deprecated kept for team-stats PDF compatibility */
  home: {
    header: [20, 48, 82] as [number, number, number],
    cell: [245, 247, 250] as [number, number, number],
    text: [20, 48, 82] as [number, number, number],
  },
  away: {
    header: [20, 48, 82] as [number, number, number],
    cell: [245, 247, 250] as [number, number, number],
    text: [20, 48, 82] as [number, number, number],
  },
  titleBar: [20, 48, 82] as [number, number, number],
  neutralHeader: [45, 55, 70] as [number, number, number],
} as const;

const PAGE_MARGIN = 36;
const HEADER_BAND_Y = 18;
const FOOTER_BAND_OFFSET = 28;
const BRAND_LOGO_SRC = '/brand/run-it-back-logo.png';

const COMPACT_TABLE_STYLES = {
  fontSize: 8,
  cellPadding: 2.2,
  halign: 'center' as const,
  lineColor: PDF_REPORT_THEME.rule,
  lineWidth: 0.4,
};

const BOX_SCORE_FONT_SIZE = 7;
const BOX_SCORE_CELL_PADDING = 1.8;
const BOX_SCORE_SIDE_MARGIN = 22;

type PdfFontStyle = 'normal' | 'bold' | 'italic';
type Rgb = [number, number, number];

interface LoadedImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG' | 'WEBP';
}

interface ReportImages {
  brand: LoadedImage | null;
  tournament: LoadedImage | null;
  home: LoadedImage | null;
  away: LoadedImage | null;
}

function measureBoxScoreTextWidth(
  doc: jsPDF,
  text: string,
  fontStyle: PdfFontStyle
): number {
  doc.setFontSize(BOX_SCORE_FONT_SIZE);
  doc.setFont('helvetica', fontStyle);
  return doc.getTextWidth(text);
}

function fontStyleForBoxScoreRow(
  kind: GameReportBoxScoreRow['kind']
): PdfFontStyle {
  if (kind === 'team_total') return 'bold';
  if (kind === 'team_coach' || kind === 'bench_divider') return 'italic';
  return 'normal';
}

function computeBoxScoreColumnWidths(
  doc: jsPDF,
  headers: readonly string[],
  body: string[][],
  rowKinds: GameReportBoxScoreRow['kind'][],
  availableWidth: number
): number[] {
  const colCount = headers.length;
  const maxWidths = Array.from({ length: colCount }, () => 0);

  headers.forEach((header, col) => {
    maxWidths[col] = Math.max(
      maxWidths[col]!,
      measureBoxScoreTextWidth(doc, header, 'bold')
    );
  });

  body.forEach((row, rowIndex) => {
    const kind = rowKinds[rowIndex]!;
    const fontStyle = fontStyleForBoxScoreRow(kind);
    row.forEach((cell, col) => {
      if (kind === 'bench_divider' && col > 1) return;
      if (!cell) return;
      maxWidths[col] = Math.max(
        maxWidths[col]!,
        measureBoxScoreTextWidth(doc, cell, fontStyle)
      );
    });
  });

  const horizontalPadding = BOX_SCORE_CELL_PADDING * 2;
  let widths = maxWidths.map((width) => Math.ceil(width + horizontalPadding + 0.5));
  // Prefer a wider Player column for full names.
  widths[1] = Math.max(widths[1]!, 52);

  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total > availableWidth) {
    const scale = availableWidth / total;
    widths = widths.map((width) => Math.max(10, Math.floor(width * scale)));
    const scaled = widths.reduce((sum, width) => sum + width, 0);
    const drift = availableWidth - scaled;
    widths[1] = Math.max(24, widths[1]! + drift);
  }

  return widths;
}

function buildBoxScoreColumnStyles(
  columnWidths: number[]
): Record<number, { cellWidth: number; halign: 'left' | 'center' }> {
  return Object.fromEntries(
    columnWidths.map((cellWidth, index) => [
      index,
      {
        cellWidth,
        halign: (index === 1 ? 'left' : 'center') as 'left' | 'center',
      },
    ])
  );
}

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

function contentBottomLimit(doc: jsPDF): number {
  return getPageHeight(doc) - FOOTER_BAND_OFFSET - 10;
}

function formatExportTimestamp(date = new Date()): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function absoluteAssetUrl(src: string): string {
  const trimmed = src.trim();
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (typeof window !== 'undefined' && window.location?.origin) {
    if (trimmed.startsWith('/')) return `${window.location.origin}${trimmed}`;
    return `${window.location.origin}/${trimmed}`;
  }
  return trimmed;
}

function detectImageFormat(src: string): LoadedImage['format'] {
  const lower = src.toLowerCase();
  if (lower.includes('image/jpeg') || lower.includes('image/jpg') || /\.jpe?g(\?|#|$)/.test(lower)) {
    return 'JPEG';
  }
  if (lower.includes('image/webp') || /\.webp(\?|#|$)/.test(lower)) {
    return 'WEBP';
  }
  return 'PNG';
}

async function loadImageForPdf(src: string | null | undefined): Promise<LoadedImage | null> {
  if (!src?.trim()) return null;
  if (!isTeamIconImage(src) && !src.startsWith('/')) return null;

  try {
    const url = absoluteAssetUrl(src);
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('read failed'));
      };
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, format: detectImageFormat(src) };
  } catch {
    return null;
  }
}

async function loadReportImages(model: GameReportModel): Promise<ReportImages> {
  const [brand, tournament, home, away] = await Promise.all([
    loadImageForPdf(BRAND_LOGO_SRC),
    loadImageForPdf(model.tournamentIcon),
    loadImageForPdf(model.homeIcon),
    loadImageForPdf(model.awayIcon),
  ]);
  return { brand, tournament, home, away };
}

function drawImage(
  doc: jsPDF,
  image: LoadedImage | null,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (!image) return;
  try {
    doc.addImage(image.dataUrl, image.format, x, y, w, h);
  } catch {
    // Graceful skip if format unsupported in this build.
  }
}

function drawHorizontalRule(doc: jsPDF, y: number, inset = PAGE_MARGIN): void {
  const pageWidth = getPageWidth(doc);
  doc.setDrawColor(...PDF_REPORT_THEME.rule);
  doc.setLineWidth(0.6);
  doc.line(inset, y, pageWidth - inset, y);
}

function buildMetadataLine(model: GameReportModel): string {
  const parts: string[] = [model.formattedDateWithWeekday];
  if (model.startTime) parts.push(model.startTime);
  if (model.seasonYear != null) parts.push(String(model.seasonYear));
  if (model.gameNumber != null) parts.push(`Game ${model.gameNumber}`);
  if (model.stageLabel) parts.push(model.stageLabel);
  if (model.groupLabel) parts.push(model.groupLabel);
  if (model.bracketSlotLabel) parts.push(model.bracketSlotLabel);
  return parts.join('  ·  ');
}

function buildBadgeLine(model: GameReportModel): string {
  const badges: string[] = ['FINAL', model.gameFormat === '3x3' ? '3×3' : '5v5'];
  if (model.isFriendly) badges.push('FRIENDLY');
  if (model.overtimeLabel) badges.push(model.overtimeLabel);
  return badges.join('   ');
}

function drawPageChromeFooter(
  doc: jsPDF,
  _model: GameReportModel,
  pageNumber: number,
  totalPages: number,
  exportedAt: string
): void {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const y = pageHeight - FOOTER_BAND_OFFSET;

  drawHorizontalRule(doc, y - 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF_REPORT_THEME.navyMuted);

  const left = 'For official use';
  const center = `Page ${pageNumber} of ${totalPages}`;
  const right = `Generated by RunItBack  ·  ${exportedAt}`;

  doc.text(left, PAGE_MARGIN, y);
  doc.text(center, pageWidth / 2, y, { align: 'center' });
  doc.text(right, pageWidth - PAGE_MARGIN, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

function drawMasthead(
  doc: jsPDF,
  model: GameReportModel,
  images: ReportImages,
  compact = false
): number {
  const pageWidth = getPageWidth(doc);
  let y = HEADER_BAND_Y;
  const logoSize = compact ? 22 : 28;

  drawImage(doc, images.brand, PAGE_MARGIN, y - 4, logoSize, logoSize);
  drawImage(
    doc,
    images.tournament,
    pageWidth - PAGE_MARGIN - logoSize,
    y - 4,
    logoSize,
    logoSize
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(compact ? 12 : 14);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  const title =
    model.tournamentName?.trim() ||
    (model.isFriendly ? 'Friendly Game' : 'Game Report');
  doc.text(title, pageWidth / 2, y + (compact ? 6 : 8), { align: 'center' });

  y += compact ? 16 : 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(compact ? 8 : 9);
  doc.text('Official Box Score', pageWidth / 2, y, { align: 'center' });

  y += compact ? 10 : 12;
  doc.setFontSize(7);
  doc.setTextColor(...PDF_REPORT_THEME.navyMuted);
  doc.text(buildBadgeLine(model), pageWidth / 2, y, { align: 'center' });

  y += compact ? 8 : 10;
  drawHorizontalRule(doc, y);
  y += compact ? 10 : 14;

  doc.setFontSize(compact ? 7 : 8);
  doc.setTextColor(50, 50, 50);
  const meta = buildMetadataLine(model);
  const metaLines = doc.splitTextToSize(meta, pageWidth - PAGE_MARGIN * 2);
  doc.text(metaLines, pageWidth / 2, y, { align: 'center' });
  y += metaLines.length * (compact ? 8 : 10) + (compact ? 4 : 6);

  return y;
}

function drawScoreboard(
  doc: jsPDF,
  model: GameReportModel,
  images: ReportImages,
  startY: number,
  compact = false
): number {
  const pageWidth = getPageWidth(doc);
  const centerX = pageWidth / 2;
  const blockWidth = (pageWidth - PAGE_MARGIN * 2 - 24) / 2;
  const blockHeight = compact ? 46 : 58;
  const boxTop = startY;

  const homeX = PAGE_MARGIN;
  const awayX = PAGE_MARGIN + blockWidth + 24;

  doc.setDrawColor(...PDF_REPORT_THEME.rule);
  doc.setLineWidth(0.5);
  doc.rect(homeX, boxTop, blockWidth, blockHeight);
  doc.rect(awayX, boxTop, blockWidth, blockHeight);

  const logo = compact ? 16 : 22;
  drawImage(doc, images.home, homeX + 8, boxTop + 10, logo, logo);
  drawImage(doc, images.away, awayX + 8, boxTop + 10, logo, logo);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...PDF_REPORT_THEME.navyMuted);
  doc.text('HOME', homeX + blockWidth / 2, boxTop + 10, { align: 'center' });
  doc.text('AWAY', awayX + blockWidth / 2, boxTop + 10, { align: 'center' });

  doc.setFontSize(compact ? 9 : 10);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  const homeName = doc.splitTextToSize(model.homeTeamName, blockWidth - 36);
  const awayName = doc.splitTextToSize(model.awayTeamName, blockWidth - 36);
  doc.text(homeName, homeX + 32, boxTop + 24);
  doc.text(awayName, awayX + 32, boxTop + 24);

  doc.setFontSize(compact ? 18 : 22);
  doc.text(String(model.homeScore), homeX + blockWidth - 12, boxTop + (compact ? 32 : 40), {
    align: 'right',
  });
  doc.text(String(model.awayScore), awayX + blockWidth - 12, boxTop + (compact ? 32 : 40), {
    align: 'right',
  });

  // jsPDF y is the text baseline — large fonts extend upward, so clear the box first.
  const scoreFontSize = compact ? 13 : 16;
  const boxBottom = boxTop + blockHeight;
  let y = boxBottom + scoreFontSize + (compact ? 12 : 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(scoreFontSize);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  const scoreText = `${model.homeAbbr}  ${model.homeScore}  –  ${model.awayScore}  ${model.awayAbbr}`;
  doc.text(scoreText, centerX, y, { align: 'center' });
  if (model.overtimeLabel) {
    y += compact ? 12 : 14;
    doc.setFontSize(8);
    doc.setTextColor(...PDF_REPORT_THEME.navyMuted);
    doc.text(`FINAL / ${model.overtimeLabel}`, centerX, y, { align: 'center' });
  }

  y += compact ? 14 : 18;
  if (model.periodStrip) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(compact ? 7 : 8);
    doc.setTextColor(60, 60, 60);
    const stripLines = doc.splitTextToSize(
      model.periodStrip,
      pageWidth - PAGE_MARGIN * 2
    );
    doc.text(stripLines, centerX, y, { align: 'center' });
    y += stripLines.length * (compact ? 9 : 11);
  }

  // Extra breathing room before Game Leaders.
  return y + (compact ? 12 : 16);
}

function drawLeaders(
  doc: jsPDF,
  model: GameReportModel,
  startY: number,
  compact = false
): number {
  const pageWidth = getPageWidth(doc);
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(compact ? 9 : 10);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  doc.text('Game Leaders', pageWidth / 2, y, { align: 'center' });
  y += compact ? 12 : 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(compact ? 7 : 8);
  doc.setTextColor(45, 45, 45);

  if (compact && model.leaders.length >= 2) {
    const mid = Math.ceil(model.leaders.length / 2);
    const leftCol = model.leaders.slice(0, mid);
    const rightCol = model.leaders.slice(mid);
    const leftX = PAGE_MARGIN;
    const rightX = pageWidth / 2 + 4;
    const rows = Math.max(leftCol.length, rightCol.length);
    for (let i = 0; i < rows; i++) {
      const left = leftCol[i];
      const right = rightCol[i];
      if (left) {
        doc.text(`${left.label}: ${left.text}`, leftX, y, {
          maxWidth: pageWidth / 2 - PAGE_MARGIN - 8,
        });
      }
      if (right) {
        doc.text(`${right.label}: ${right.text}`, rightX, y, {
          maxWidth: pageWidth / 2 - PAGE_MARGIN - 8,
        });
      }
      y += 11;
    }
  } else {
    for (const leader of model.leaders) {
      doc.text(`${leader.label}: ${leader.text}`, pageWidth / 2, y, {
        align: 'center',
      });
      y += 12;
    }
  }

  return y + (compact ? 10 : 12);
}

function measureComparisonStatColumnWidth(
  doc: jsPDF,
  rows: GameReportComparisonRow[],
  headLabel: string,
  fontSize: number,
  tableWidth: number
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  let maxText = doc.getTextWidth(headLabel);
  for (const row of rows) {
    maxText = Math.max(maxText, doc.getTextWidth(row.label));
  }
  // Tight padding — avoid the old fixed ~44% gap on short labels.
  const padded = Math.ceil(maxText + 6);
  const minValueCol = 34;
  const maxStat = tableWidth - minValueCol * 2;
  return Math.max(26, Math.min(padded, maxStat));
}

function drawComparisonTable(
  doc: jsPDF,
  options: {
    startY: number;
    left: number;
    tableWidth: number;
    title: string;
    head: string[];
    rows: GameReportComparisonRow[];
    compact?: boolean;
  }
): number {
  const pageWidth = getPageWidth(doc);
  const {
    startY,
    left,
    tableWidth,
    title,
    head,
    rows,
    compact = false,
  } = options;
  const titleSize = compact ? 9 : 10.5;
  const bodySize = compact ? 7.5 : 8.5;
  const cellPadding = compact ? 2 : 2.4;
  const statColumnWidth = measureComparisonStatColumnWidth(
    doc,
    rows,
    head[0] ?? 'Stat',
    bodySize,
    tableWidth
  );
  const valueWidth = (tableWidth - statColumnWidth) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  doc.text(title, left + tableWidth / 2, startY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: startY + 8,
    tableWidth,
    margin: { left, right: pageWidth - left - tableWidth },
    head: [head],
    body: rows.map((row) => [row.label, row.home, row.away]),
    theme: 'grid',
    styles: {
      ...COMPACT_TABLE_STYLES,
      fontSize: bodySize,
      cellPadding,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: PDF_REPORT_THEME.navy,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: bodySize,
    },
    columnStyles: {
      0: {
        cellWidth: statColumnWidth,
        halign: 'left',
        fontStyle: 'bold',
      },
      1: { cellWidth: valueWidth, halign: 'center' },
      2: { cellWidth: valueWidth, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;

      if (row.sharedValue) {
        if (data.column.index === 1) {
          data.cell.colSpan = 2;
          data.cell.styles.halign = 'center';
          data.cell.text = [row.home];
        }
        if (data.column.index === 2) {
          data.cell.text = [];
        }
        return;
      }

      if (data.column.index === 0) return;
      const side = data.column.index === 1 ? 'home' : 'away';
      if (row.winner === side) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = PDF_REPORT_THEME.winnerFill;
      }
    },
  });

  return getLastTableBottom(doc) ?? startY + 40;
}

/** Draw Shooting / Team stats / Scoring context in one horizontal row. */
function drawComparisonTablesRow(
  doc: jsPDF,
  model: GameReportModel,
  startY: number,
  compact: boolean
): number {
  const pageWidth = getPageWidth(doc);
  const gap = compact ? 6 : 8;
  // Use slightly tighter side margins so the three tables can be larger.
  const sideMargin = Math.max(22, PAGE_MARGIN - 10);
  const available = pageWidth - sideMargin * 2;
  const tableWidth = Math.floor((available - gap * 2) / 3);
  const head = ['Stat', model.homeAbbr, model.awayAbbr] as string[];

  const sections: {
    title: string;
    rows: GameReportComparisonRow[];
  }[] = [
    { title: 'Shooting', rows: model.shootingComparisonRows },
    { title: 'Team stats', rows: model.teamStatComparisonRows },
    { title: 'Scoring context', rows: model.scoringContextComparisonRows },
  ];

  let bottom = startY;
  sections.forEach((section, index) => {
    const left = sideMargin + index * (tableWidth + gap);
    const finalY = drawComparisonTable(doc, {
      startY,
      left,
      tableWidth,
      title: section.title,
      head,
      rows: section.rows,
      compact,
    });
    bottom = Math.max(bottom, finalY);
  });

  return bottom;
}

function drawQuarterTable(
  doc: jsPDF,
  model: GameReportModel,
  startY: number
): number {
  const pageWidth = getPageWidth(doc);
  const tableWidth = Math.min(280, pageWidth - PAGE_MARGIN * 2);
  const left = (pageWidth - tableWidth) / 2;
  const statColumnWidth = 48;
  const valueWidth = (tableWidth - statColumnWidth) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  doc.text('Quarter Scoring', pageWidth / 2, startY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: startY + 8,
    tableWidth,
    margin: { left, right: pageWidth - left - tableWidth },
    head: [['Period', model.homeAbbr, model.awayAbbr]],
    body: model.quarterRows.map((row) => [row.label, row.home, row.away]),
    theme: 'grid',
    styles: COMPACT_TABLE_STYLES,
    headStyles: {
      fillColor: PDF_REPORT_THEME.navy,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: statColumnWidth, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: valueWidth, halign: 'center' },
      2: { cellWidth: valueWidth, halign: 'center' },
    },
  });

  return getLastTableBottom(doc) ?? startY + 40;
}

function rowStyleForKind(kind: GameReportBoxScoreRow['kind']): {
  fontStyle?: 'bold' | 'italic';
  fillColor?: Rgb;
  textColor?: Rgb;
} {
  switch (kind) {
    case 'team_total':
      return {
        fontStyle: 'bold',
        fillColor: PDF_REPORT_THEME.totalsFill,
        textColor: [255, 255, 255],
      };
    case 'team_coach':
      return { fontStyle: 'italic', fillColor: [245, 245, 245] };
    case 'bench_divider':
      return { fontStyle: 'italic', fillColor: [250, 250, 250] };
    default:
      return {};
  }
}

function drawBoxScoreSection(
  doc: jsPDF,
  startY: number,
  sectionTitle: string,
  rows: GameReportBoxScoreRow[]
): number {
  const pageWidth = getPageWidth(doc);
  const availableWidth = pageWidth - BOX_SCORE_SIDE_MARGIN * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  doc.text(sectionTitle, pageWidth / 2, startY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const body = rows.map((row) => row.cells);
  const rowKinds = rows.map((row) => row.kind);
  const headers = Array.from(PDF_BOX_SCORE_HEADERS);
  const columnWidths = computeBoxScoreColumnWidths(
    doc,
    headers,
    body,
    rowKinds,
    availableWidth
  );
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const tableLeft = (pageWidth - tableWidth) / 2;

  autoTable(doc, {
    startY: startY + 10,
    margin: {
      left: tableLeft,
      right: pageWidth - tableLeft - tableWidth,
    },
    tableWidth,
    head: [headers],
    body,
    theme: 'grid',
    styles: {
      fontSize: BOX_SCORE_FONT_SIZE,
      cellPadding: BOX_SCORE_CELL_PADDING,
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
      fontSize: BOX_SCORE_FONT_SIZE,
      halign: 'center',
    },
    columnStyles: buildBoxScoreColumnStyles(columnWidths),
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const kind = rowKinds[data.row.index];
      const style = rowStyleForKind(kind);
      if (style.fontStyle) data.cell.styles.fontStyle = style.fontStyle;
      if (style.fillColor) data.cell.styles.fillColor = style.fillColor;
      if (style.textColor) data.cell.styles.textColor = style.textColor;

      if (kind === 'bench_divider' && data.column.index === 1) {
        data.cell.colSpan = PDF_BOX_SCORE_HEADERS.length - 1;
      }
      if (kind === 'bench_divider' && data.column.index > 1) {
        data.cell.text = [];
      }
    },
  });

  return getLastTableBottom(doc) ?? startY + 80;
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  needed: number
): number {
  if (y + needed <= contentBottomLimit(doc)) return y;
  doc.addPage('letter', 'portrait');
  return 36;
}

function drawSummaryContent(
  doc: jsPDF,
  model: GameReportModel,
  images: ReportImages,
  mode: GameReportExportOptions['mode']
): void {
  const compact = mode === 'media';
  let y = drawMasthead(doc, model, images, compact);
  y = drawScoreboard(doc, model, images, y, compact);
  y = drawLeaders(doc, model, y, compact);

  const sectionGap = compact ? 12 : 16;
  // Tallest section is ~9 rows — reserve space before placing the row.
  y = ensureSpace(doc, y, compact ? 160 : 200);
  y = drawComparisonTablesRow(doc, model, y, compact);

  if (compact) return;

  y = y + sectionGap;
  y = ensureSpace(doc, y, 100);
  drawQuarterTable(doc, model, y);
}

function drawBoxScores(doc: jsPDF, model: GameReportModel): void {
  doc.addPage('letter', 'portrait');
  let y = 36;
  const pageHeightLimit = contentBottomLimit(doc);

  for (let i = 0; i < model.boxScores.length; i++) {
    const section = model.boxScores[i]!;
    const title = `${section.teamName} (${section.abbreviation}) — ${section.score} PTS`;

    if (i > 0) {
      if (y > pageHeightLimit - 140) {
        doc.addPage('letter', 'portrait');
        y = 36;
      } else {
        y += 18;
      }
    }

    const finalY = drawBoxScoreSection(
      doc,
      y,
      title,
      section.rows
    );
    y = finalY + 8;
  }
}

function drawComingSoonPage(doc: jsPDF, title: string, body: string): void {
  doc.addPage('letter', 'portrait');
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const boxTop = 72;
  const boxHeight = pageHeight - boxTop - FOOTER_BAND_OFFSET - 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  doc.text(title, pageWidth / 2, 48, { align: 'center' });

  doc.setDrawColor(...PDF_REPORT_THEME.rule);
  doc.setLineWidth(0.8);
  doc.rect(PAGE_MARGIN, boxTop, pageWidth - PAGE_MARGIN * 2, boxHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_REPORT_THEME.navyMuted);
  const lines = doc.splitTextToSize(body, pageWidth - PAGE_MARGIN * 2 - 48);
  doc.text(lines, pageWidth / 2, boxTop + boxHeight / 2 - 6, {
    align: 'center',
  });
  doc.setTextColor(0, 0, 0);
}

/** Basket at top; shot.y=100 is baseline/basket, shot.y=0 is midcourt. */
function drawHalfCourtOutline(
  doc: jsPDF,
  left: number,
  top: number,
  width: number,
  height: number
): void {
  doc.setDrawColor(...PDF_REPORT_THEME.navy);
  doc.setLineWidth(1);
  doc.rect(left, top, width, height);

  const cx = left + width / 2;
  const paintW = width * (4.9 / 15);
  const paintH = height * (5.8 / 14);
  doc.rect(cx - paintW / 2, top, paintW, paintH);

  const rimR = Math.min(width, height) * 0.035;
  doc.circle(cx, top + height * 0.04, rimR);
  doc.setLineWidth(0.6);
  const ftR = paintW * 0.55;
  doc.circle(cx, top + paintH, ftR, 'S');
  doc.setLineWidth(0.8);
  const threeR = height * (6.75 / 14);
  doc.circle(cx, top + height * 0.04, threeR, 'S');
}

function drawShotChartPage(doc: jsPDF, model: GameReportModel): void {
  if (model.shotMarkers.length === 0) return;

  doc.addPage('letter', 'portrait');
  const pageWidth = getPageWidth(doc);
  let y = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PDF_REPORT_THEME.navy);
  doc.text('Shot Chart', pageWidth / 2, y, { align: 'center' });
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_REPORT_THEME.navyMuted);
  doc.text(
    `${model.shotMarkers.length} located shots  ·  green = make  ·  red = miss`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 16;

  const courtWidth = Math.min(360, pageWidth - PAGE_MARGIN * 2);
  const courtHeight = courtWidth * (14 / 15);
  const left = (pageWidth - courtWidth) / 2;

  drawHalfCourtOutline(doc, left, y, courtWidth, courtHeight);

  for (const shot of model.shotMarkers) {
    const px = left + (Math.min(100, Math.max(0, shot.x)) / 100) * courtWidth;
    const py =
      y + ((100 - Math.min(100, Math.max(0, shot.y))) / 100) * courtHeight;

    if (shot.made) {
      doc.setFillColor(34, 160, 90);
      doc.circle(px, py, 2.2, 'F');
    } else {
      doc.setDrawColor(200, 50, 50);
      doc.setLineWidth(0.9);
      doc.line(px - 2.2, py - 2.2, px + 2.2, py + 2.2);
      doc.line(px - 2.2, py + 2.2, px + 2.2, py - 2.2);
    }
  }

  doc.setTextColor(0, 0, 0);
}

export async function generateGameReportPdf(
  model: GameReportModel,
  options: GameReportExportOptions = DEFAULT_GAME_REPORT_EXPORT_OPTIONS
): Promise<Blob> {
  const images = await loadReportImages(model);
  const exportedAt = formatExportTimestamp();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  drawSummaryContent(doc, model, images, options.mode);

  if (options.mode === 'full') {
    drawBoxScores(doc, model);

    if (options.includeShotChart && model.hasShotChartData) {
      drawShotChartPage(doc, model);
    }

    if (options.includeComingSoonPlaceholders) {
      drawComingSoonPage(doc, 'Lineup stints', LINEUP_STINTS_COMING_SOON_COPY);
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    drawPageChromeFooter(doc, model, page, totalPages, exportedAt);
  }

  return doc.output('blob');
}

export async function downloadGameReportPdf(
  game: Game,
  tournaments: Tournament[] = [],
  options: GameReportExportOptions = DEFAULT_GAME_REPORT_EXPORT_OPTIONS,
  leagueGames?: Game[]
): Promise<void> {
  const model = buildGameReportModel(game, tournaments, { leagueGames });
  const blob = await generateGameReportPdf(model, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = model.filename;
  link.click();
  URL.revokeObjectURL(url);
}
