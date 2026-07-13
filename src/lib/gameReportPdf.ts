import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Game, Tournament } from '../App';
import {
  buildGameReportModel,
  PDF_BOX_SCORE_HEADERS,
  type GameReportBoxScoreRow,
  type GameReportModel,
} from '../utils/gameReportModel';

const PAGE_TITLE = 'BASKETBALL BOX SCORE';

/** Matches live-entry home/away accents (index.css). */
export const PDF_REPORT_THEME = {
  home: {
    header: [0, 140, 180] as [number, number, number],
    cell: [224, 247, 255] as [number, number, number],
    text: [0, 90, 120] as [number, number, number],
  },
  away: {
    header: [230, 138, 0] as [number, number, number],
    cell: [255, 243, 224] as [number, number, number],
    text: [150, 85, 0] as [number, number, number],
  },
  titleBar: [20, 48, 82] as [number, number, number],
  neutralHeader: [45, 45, 45] as [number, number, number],
} as const;

/** Narrow summary tables — centered on page 1. */
const COMPARISON_TABLE_WIDTH = 230;
const QUARTER_TABLE_WIDTH = 150;
const SUMMARY_TABLE_GAP = 28;

const COMPACT_TABLE_STYLES = {
  fontSize: 8,
  cellPadding: 2.5,
  halign: 'center' as const,
};

const BOX_SCORE_FONT_SIZE = 6.5;
const BOX_SCORE_CELL_PADDING = 1.5;

type PdfFontStyle = 'normal' | 'bold' | 'italic';

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
  rowKinds: GameReportBoxScoreRow['kind'][]
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
  return maxWidths.map((width) => Math.ceil(width + horizontalPadding + 1));
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

function getLastTableBottom(doc: jsPDF): number | undefined {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY;
}

function rowStyleForKind(kind: GameReportBoxScoreRow['kind']): {
  fontStyle?: 'bold' | 'italic';
  fillColor?: [number, number, number];
} {
  switch (kind) {
    case 'team_total':
      return { fontStyle: 'bold', fillColor: [235, 235, 235] };
    case 'team_coach':
      return { fontStyle: 'italic', fillColor: [245, 245, 245] };
    case 'bench_divider':
      return { fontStyle: 'italic', fillColor: [250, 250, 250] };
    default:
      return {};
  }
}

function drawCompactSummaryTable(
  doc: jsPDF,
  options: {
    startY: number;
    left: number;
    tableWidth: number;
    title: string;
    titleColor: [number, number, number];
    head: string[];
    body: string[][];
    statColumnWidth: number;
  }
): void {
  const {
    startY,
    left,
    tableWidth,
    title,
    titleColor,
    head,
    body,
    statColumnWidth,
  } = options;
  const valueWidth = (tableWidth - statColumnWidth) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...titleColor);
  doc.text(title, left + tableWidth / 2, startY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: startY + 10,
    tableWidth,
    margin: { left, right: getPageWidth(doc) - left - tableWidth },
    head: [head],
    body,
    theme: 'grid',
    styles: COMPACT_TABLE_STYLES,
    headStyles: {
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
    didParseCell: (data) => {
      if (data.section === 'head') {
        if (data.column.index === 0) {
          data.cell.styles.fillColor = PDF_REPORT_THEME.neutralHeader;
        } else if (data.column.index === 1) {
          data.cell.styles.fillColor = PDF_REPORT_THEME.home.header;
        } else if (data.column.index === 2) {
          data.cell.styles.fillColor = PDF_REPORT_THEME.away.header;
        }
        return;
      }
      if (data.section !== 'body') return;
      if (data.column.index === 0) return;
      data.cell.styles.fillColor =
        data.column.index === 1
          ? PDF_REPORT_THEME.home.cell
          : PDF_REPORT_THEME.away.cell;
    },
  });
}

function drawSummaryPage(doc: jsPDF, model: GameReportModel): number {
  const pageWidth = getPageWidth(doc);
  const centerX = pageWidth / 2;
  let y = 44;

  doc.setTextColor(20, 48, 82);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(PAGE_TITLE, centerX, y, { align: 'center' });
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  if (model.tournamentName) {
    doc.text(model.tournamentName, centerX, y, { align: 'center' });
    y += 16;
  }
  doc.text(model.formattedDate, centerX, y, { align: 'center' });
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`${model.homeTeamLabel}  vs  ${model.awayTeamLabel}`, centerX, y, {
    align: 'center',
  });
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const scoreParts = model.scoreLine.match(/^(.+?)\s+(\d+)\s+-\s+(\d+)\s+(.+)$/);
  if (scoreParts) {
    const [, homeAbbr, homeScore, awayScore, awayAbbr] = scoreParts;
    const scoreText = `${homeAbbr} ${homeScore}  -  ${awayScore} ${awayAbbr}`;
    doc.setTextColor(20, 48, 82);
    doc.text(scoreText, centerX, y, { align: 'center' });

    const textWidth = doc.getTextWidth(scoreText);
    const accentY = y + 6;
    const accentStart = centerX - textWidth / 2;
    const homeWidth = doc.getTextWidth(`${homeAbbr} ${homeScore}  -  `);
    const awayWidth = doc.getTextWidth(`${awayScore} ${awayAbbr}`);

    doc.setDrawColor(...PDF_REPORT_THEME.home.header);
    doc.setLineWidth(2);
    doc.line(accentStart, accentY, accentStart + homeWidth, accentY);
    doc.setDrawColor(...PDF_REPORT_THEME.away.header);
    doc.line(
      accentStart + homeWidth,
      accentY,
      accentStart + homeWidth + awayWidth,
      accentY
    );
  } else {
    doc.setTextColor(20, 48, 82);
    doc.text(model.scoreLine, centerX, y, { align: 'center' });
  }
  y += 24;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Game Leaders', centerX, y, { align: 'center' });
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  for (const leader of model.leaders) {
    doc.text(`${leader.label}: ${leader.text}`, centerX, y, { align: 'center' });
    y += 12;
  }
  doc.setTextColor(0, 0, 0);
  y += 12;

  const totalTablesWidth =
    COMPARISON_TABLE_WIDTH + SUMMARY_TABLE_GAP + QUARTER_TABLE_WIDTH;
  const tablesLeft = (pageWidth - totalTablesWidth) / 2;
  const tablesStartY = y;

  drawCompactSummaryTable(doc, {
    startY: tablesStartY,
    left: tablesLeft,
    tableWidth: COMPARISON_TABLE_WIDTH,
    title: 'Team Comparison',
    titleColor: PDF_REPORT_THEME.titleBar,
    head: ['Stat', model.homeAbbr, model.awayAbbr],
    body: model.comparisonRows.map((row) => [row.label, row.home, row.away]),
    statColumnWidth: 62,
  });

  const comparisonBottom = getLastTableBottom(doc) ?? tablesStartY + 40;

  drawCompactSummaryTable(doc, {
    startY: tablesStartY,
    left: tablesLeft + COMPARISON_TABLE_WIDTH + SUMMARY_TABLE_GAP,
    tableWidth: QUARTER_TABLE_WIDTH,
    title: 'Quarter Scoring',
    titleColor: PDF_REPORT_THEME.titleBar,
    head: ['Period', model.homeAbbr, model.awayAbbr],
    body: model.quarterRows.map((row) => [row.label, row.home, row.away]),
    statColumnWidth: 44,
  });

  const quarterBottom = getLastTableBottom(doc) ?? tablesStartY + 40;

  return Math.max(comparisonBottom, quarterBottom);
}

function drawBoxScoreSection(
  doc: jsPDF,
  startY: number,
  sectionTitle: string,
  titleColor: [number, number, number],
  rows: GameReportBoxScoreRow[]
): number {
  const pageWidth = getPageWidth(doc);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...titleColor);
  doc.text(sectionTitle, pageWidth / 2, startY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const body = rows.map((row) => row.cells);
  const rowKinds = rows.map((row) => row.kind);
  const headers = Array.from(PDF_BOX_SCORE_HEADERS);
  const columnWidths = computeBoxScoreColumnWidths(doc, headers, body, rowKinds);
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const tableLeft = (pageWidth - tableWidth) / 2;

  autoTable(doc, {
    startY: startY + 8,
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
      overflow: 'hidden',
    },
    headStyles: {
      fillColor: PDF_REPORT_THEME.titleBar,
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
      if (style.fontStyle) {
        data.cell.styles.fontStyle = style.fontStyle;
      }
      if (style.fillColor) {
        data.cell.styles.fillColor = style.fillColor;
      }
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

export function generateGameReportPdf(model: GameReportModel): Blob {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  });

  drawSummaryPage(doc, model);

  doc.addPage('letter', 'landscape');

  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 36;

  for (let i = 0; i < model.boxScores.length; i++) {
    const section = model.boxScores[i]!;
    const title = `${section.teamName} (${section.abbreviation}) — ${section.score} PTS`;
    const titleColor =
      i === 0 ? PDF_REPORT_THEME.home.text : PDF_REPORT_THEME.away.text;

    if (i > 0 && y > pageHeight - 120) {
      doc.addPage('letter', 'landscape');
      y = 36;
    }

    const finalY = drawBoxScoreSection(doc, y, title, titleColor, section.rows);

    if (i < model.boxScores.length - 1) {
      y = finalY + 24;
      if (y > pageHeight - 120) {
        doc.addPage('letter', 'landscape');
        y = 36;
      }
    }
  }

  return doc.output('blob');
}

export function downloadGameReportPdf(
  game: Game,
  tournaments: Tournament[] = []
): void {
  const model = buildGameReportModel(game, tournaments);
  const blob = generateGameReportPdf(model);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = model.filename;
  link.click();
  URL.revokeObjectURL(url);
}
