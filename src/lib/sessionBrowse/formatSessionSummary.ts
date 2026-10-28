import type { SessionPageBlock, SessionSummaryInput } from './types';

/** Telegram practical max; leave headroom for HTML entities. */
export const TELEGRAM_SOFT_LIMIT = 3900;

export function formatDurationMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** e.g. "28 Oct 2026, 3:40 PM SGT" */
export function formatSgtTimestamp(d: Date): string {
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Singapore',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date}, ${time} SGT`;
}

export function escapeTelegramHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sgtDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
}

export function isDifferentSgtDay(a: Date, b: Date): boolean {
  return sgtDateString(a) !== sgtDateString(b);
}

function renderBlock(block: SessionPageBlock): string[] {
  const lines: string[] = [
    escapeTelegramHtml(
      `${block.title} (${formatDurationMmSs(block.durationMs)})`
    ),
  ];
  for (const tab of block.tabs) {
    lines.push(
      escapeTelegramHtml(
        `- ${tab.label} (${formatDurationMmSs(tab.durationMs)})`
      )
    );
  }
  if (block.filterNote) {
    lines.push(
      escapeTelegramHtml(`  filters: ${block.filterNote}`)
    );
  }
  return lines;
}

function collapseBlockTabs(block: SessionPageBlock): SessionPageBlock {
  if (block.tabs.length <= 3) return block;
  const first = block.tabs[0];
  const last = block.tabs[block.tabs.length - 1];
  const hidden = block.tabs.length - 2;
  return {
    ...block,
    tabs: [
      first,
      {
        tabKey: '_collapsed',
        label: `… (+${hidden} tabs)`,
        durationMs: block.tabs
          .slice(1, -1)
          .reduce((n, t) => n + t.durationMs, 0),
      },
      last,
    ],
  };
}

/**
 * Truncate for Telegram: collapse long tab lists, then drop oldest page blocks.
 */
export function truncateSessionBlocks(
  blocks: SessionPageBlock[],
  softLimit = TELEGRAM_SOFT_LIMIT,
  headerLines: string[] = []
): SessionPageBlock[] {
  let next = blocks.map((b) => ({
    ...b,
    tabs: b.tabs.map((t) => ({ ...t })),
  }));

  const measure = (bs: SessionPageBlock[]) =>
    [...headerLines, ...bs.flatMap(renderBlock), 'Session end.'].join('\n')
      .length;

  if (measure(next) <= softLimit) return next;

  next = next.map(collapseBlockTabs);
  if (measure(next) <= softLimit) return next;

  while (next.length > 1 && measure(next) > softLimit) {
    const dropped = next.length - 1;
    next = next.slice(1);
    if (next[0] && !next[0].title.startsWith('…')) {
      next = [
        {
          key: '_dropped',
          title: `… (+${dropped} earlier pages)`,
          durationMs: 0,
          tabs: [],
        },
        ...next,
      ];
      break;
    }
  }

  while (next.length > 1 && measure(next) > softLimit) {
    next = next.slice(1);
  }
  return next;
}

/** HTML-formatted session summary for Telegram parse_mode HTML. */
export function formatSessionSummaryText(input: SessionSummaryInput): string {
  const header = [
    '<b>Session Summary</b>',
    escapeTelegramHtml(input.displayName),
    escapeTelegramHtml(input.email || '(no email)'),
    escapeTelegramHtml(formatSgtTimestamp(input.startedAt)),
    `<b>Total ${formatDurationMmSs(input.activeDurationMs)}</b>`,
  ];
  const blocks = truncateSessionBlocks(
    input.blocks,
    TELEGRAM_SOFT_LIMIT,
    header
  );
  const body = blocks.flatMap(renderBlock);
  return [...header, ...body, 'Session end.'].join('\n');
}
