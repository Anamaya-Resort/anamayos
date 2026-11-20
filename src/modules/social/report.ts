import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail, type SendResult } from '@/lib/email';
import { buildRange, getSocialDashboard } from './queries';
import { METRICS, change, formatById, sumPosts } from './metrics';
import { onMaturity } from './aggregate';
import { postRowVMs } from './view-models';
import type { Platform } from './types';

/**
 * The weekly summary, as an email.
 *
 * Written to be read on a phone in ten seconds: what moved, what won,
 * what to stop. Deliberately NOT a copy of the dashboard. A report that
 * repeats every panel is a report nobody opens twice, and anyone who
 * wants the detail has the link at the bottom.
 *
 * Inlined styles, because email clients discard a stylesheet. This is
 * the one place in the codebase where a hex value is allowed, and these
 * are the brand's own, duplicated here rather than read from CSS
 * because an email has no access to the app's tokens.
 */

const INK = '#2B2B2B';
const MUTED = '#6B6B6B';
const TERRA = '#A35B4E';
const RULE = '#E3E0D6';

/** The headline numbers, in the order they are read. */
const HEADLINES = ['views', 'reach', 'profileVisitRate', 'saveRate', 'engagementRate'];

export interface ReportOutcome extends SendResult {
  recipients: number;
  subject?: string;
}

/** Comma or newline separated, from the marketing settings table. */
async function recipients(): Promise<string[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('marketing_settings')
    .select('setting_value')
    .eq('platform_key', 'instagram')
    .eq('setting_key', 'report_recipients')
    .maybeSingle();
  return String(data?.setting_value ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendWeeklyReport(
  platform: Platform = 'instagram',
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ao.anamaya.com',
): Promise<ReportOutcome> {
  const to = await recipients();
  if (to.length === 0) {
    return {
      sent: false, recipients: 0,
      reason: 'No report_recipients saved for instagram in the connections panel.',
    };
  }

  const range = buildRange(7, '7d');
  const data = await getSocialDashboard(platform, range);
  if (!data) return { sent: false, recipients: to.length, reason: 'No account to report on.' };

  const now = sumPosts(data.posts);
  const before = sumPosts(data.prevPosts);
  const locale = 'en';

  const rows = HEADLINES.map((id) => {
    const metric = METRICS[id];
    const value = metric.compute(now);
    const prior = metric.compute(before);
    const delta = value !== null && prior !== null ? change(value, prior) : null;
    const better = delta === null ? null : (delta >= 0) === metric.higherIsBetter;
    return {
      label: metric.labelKey,
      value: formatById(id, value, locale),
      delta: delta === null ? '' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`,
      colour: better === null ? MUTED : better ? '#5C7A33' : TERRA,
    };
  });

  const ranked = postRowVMs(onMaturity(data.posts), data.pillars)
    .filter((p) => p.saveRate !== null)
    .sort((a, b) => (b.saveRate ?? 0) - (a.saveRate ?? 0));

  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-2).reverse();

  const postList = (list: typeof ranked) => list.map((p) => `
    <tr>
      <td style="padding:8px 0;border-top:1px solid ${RULE};">
        <div style="font-size:14px;color:${INK};">${esc(p.caption.slice(0, 90))}</div>
        <div style="font-size:12px;color:${MUTED};">
          ${esc(p.pillarName)} · ${formatById('saveRate', p.saveRate, locale)} save rate
          · ${formatById('reach', p.reach, locale)} reach
        </div>
      </td>
    </tr>`).join('');

  const html = `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:${INK};">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};margin:0 0 4px;">
    ${esc(data.platform)} · ${range.from} to ${range.to}
  </p>
  <h1 style="font-size:24px;margin:0 0 16px;">Last week on social</h1>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    ${rows.map((r) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${MUTED};">${esc(r.label)}</td>
      <td style="padding:6px 0;font-size:16px;font-weight:bold;text-align:right;">${esc(r.value)}</td>
      <td style="padding:6px 0 6px 12px;font-size:13px;text-align:right;color:${r.colour};">${esc(r.delta)}</td>
    </tr>`).join('')}
  </table>

  <h2 style="font-size:16px;margin:0 0 4px;">Worth repeating</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${postList(best)}</table>

  <h2 style="font-size:16px;margin:0 0 4px;">Worth rethinking</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${postList(worst)}</table>

  <p style="font-size:13px;color:${MUTED};">
    Compared with the seven days immediately before, on the same measures.
    ${data.isSample ? '<strong>These are sample figures, not the real account.</strong>' : ''}
  </p>
  <p style="margin-top:20px;">
    <a href="${siteUrl}/smm_tracking?view=content"
       style="color:${TERRA};font-size:14px;">Open the full dashboard</a>
  </p>
</div>`;

  const subject = `Social: ${rows[0]?.value ?? ''} views, ${rows[3]?.value ?? ''} save rate`;
  const result = await sendEmail({ to, subject, html });
  return { ...result, recipients: to.length, subject };
}
