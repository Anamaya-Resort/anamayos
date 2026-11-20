import { getSession } from '@/lib/session';
import { buildCustomRange, getSocialDashboard, postRowVMs } from '@/modules/social';
import type { Platform } from '@/modules/social';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/social/export?platform=&from=&to=
 *
 * The window as a spreadsheet. One row per post, the same figures the
 * table on screen shows, so a number someone quotes from a download can
 * always be traced back to a row on the page.
 *
 * Rates are written as plain fractions rather than preformatted
 * percentages: a spreadsheet can format a number and cannot un-format
 * a string, and "5.6%" as text is the single most common way an export
 * becomes useless.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const COLUMNS = [
  'published_at', 'format', 'pillar', 'caption', 'permalink',
  'views', 'reach', 'saves', 'save_rate',
  'share_rate', 'engagement_rate', 'avg_watch_seconds', 'age_days',
] as const;

/**
 * Escapes one cell.
 *
 * The leading apostrophe guard matters: a caption beginning with =, +,
 * - or @ is executed as a formula when the file is opened, which is a
 * real way a downloaded export attacks the person who opens it.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const platform = (url.searchParams.get('platform') ?? 'instagram') as Platform;
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return Response.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
  }

  const data = await getSocialDashboard(platform, buildCustomRange(from, to));
  if (!data) return Response.json({ error: 'No account for that platform' }, { status: 404 });

  const names = new Map(data.pillars.map((p) => [p.id, p.name]));
  const rows = postRowVMs(data.posts, data.pillars);

  const lines = [COLUMNS.join(',')];
  for (const r of rows) {
    lines.push([
      r.publishedAt,
      r.format,
      r.pillarId ? names.get(r.pillarId) ?? '' : '',
      r.caption,
      r.permalink,
      r.views,
      r.reach,
      r.saves,
      r.saveRate,
      r.shareRate,
      r.engagementRate,
      r.avgWatchSeconds,
      r.ageDays,
    ].map(cell).join(','));
  }

  // The BOM is what makes Excel read UTF-8 rather than mangling every
  // accented character in a Spanish caption.
  const body = `﻿${lines.join('\r\n')}\r\n`;
  const filename = `${platform}-posts-${from}-to-${to}.csv`;

  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
