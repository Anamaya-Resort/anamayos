import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/onix/chat — 0N1X-2, the marketing advisor.
 *
 * Context is assembled server-side so live figures, campaign goals and
 * the advertising knowledge base never have to travel through the
 * browser. Runs on Claude via ANTHROPIC_API_KEY.
 *
 * Raw HTTP rather than the SDK on purpose: this route is the only caller,
 * and keeping it dependency-free avoids adding a package to the build.
 */
const MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const PERSONA = `You are 0N1X-2, a black cat robot yogi who advises the Anamaya Resort team on
digital advertising and marketing. Anamaya is a yoga retreat centre in Montezuma, Costa Rica.
Booking happens on Retreat Guru; the team never handles payment directly.

Voice: calm, warm, a little playful, never corporate. Short paragraphs. Practical, specific advice.
When you are unsure or the data does not cover something, say so plainly rather than guessing.
Never invent numbers: use only the figures given to you below, and say when a figure is missing.`;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'No AI key configured' }, { status: 503 });

  let body: { message?: string; history?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const message = (body.message ?? '').trim();
  if (!message) return Response.json({ error: 'message required' }, { status: 400 });

  const { knowledge, live } = await buildContext();

  const messages = [
    ...(body.history ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': FALLBACK_BETA,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        // Thinking is always on for this model and shares the token budget,
        // so max_tokens has to leave room for it as well as the reply.
        output_config: { effort: 'medium' },
        // If a safety classifier declines, the same request re-runs on a
        // fallback model inside this call rather than coming back empty.
        fallbacks: 'default',
        // The persona and the knowledge base are identical on every turn,
        // so they cache; the live figures change and sit after the break.
        system: [
          { type: 'text', text: `${PERSONA}\n\n---\nADVERTISING KNOWLEDGE BASE\n${knowledge}`,
            cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `---\nLIVE CONTEXT\n${live}` },
        ],
        messages,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      return Response.json({ error: `AI error ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as {
      content?: { type?: string; text?: string }[];
      stop_reason?: string;
    };

    if (data.stop_reason === 'refusal') {
      return Response.json({ error: 'That one is outside what I can answer.' }, { status: 422 });
    }

    const reply = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    if (!reply) return Response.json({ error: 'Empty reply' }, { status: 502 });

    const sb = createServiceClient();
    await sb.from('onix_messages').insert([
      { person_id: session.personId ?? null, role: 'user', content: message },
      { person_id: session.personId ?? null, role: 'assistant', content: reply },
    ]);

    return Response.json({ reply });
  } catch {
    return Response.json({ error: 'AI unreachable' }, { status: 502 });
  }
}

/**
 * Two halves: the knowledge base, which is stable and therefore cacheable,
 * and the live figures, which are not.
 *
 * Revenue is computed the same way the dashboard computes it — charge minus
 * discount on line items — so 0N1X-2 and the tiles never disagree. Summing
 * `grand_total` across all transactions would mix payments with refunds and
 * net against payouts, which is what the dashboard used to do wrongly.
 */
async function buildContext(): Promise<{ knowledge: string; live: string }> {
  const sb = createServiceClient();
  const today = new Date();
  const from = new Date(today.getTime() - 89 * 86400000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  const [sold, paid, bookings, leads, spend, goals, knowledgeRows] = await Promise.all([
    sb.from('transactions').select('charge_amount, discount_amount')
      .eq('class', 'item').gte('trans_date', from).lte('trans_date', to),
    sb.from('transactions').select('grand_total')
      .in('class', ['card_payment', 'non_cc_payment']).gte('trans_date', from).lte('trans_date', to),
    sb.from('bookings').select('id').gte('created_at', from),
    sb.from('leads').select('id').gte('created_at', from),
    sb.from('ad_spend_daily').select('platform_key, spend').gte('stat_date', from),
    sb.from('marketing_goals')
      .select('title, platform_key, period_start, period_end, target_spend, target_leads, target_bookings, target_revenue, target_roas, body')
      .eq('is_active', true).limit(20),
    sb.from('onix_knowledge').select('title, topic, body')
      .eq('is_active', true).order('sort_order').limit(40),
  ]);

  const revenue = (sold.data ?? []).reduce(
    (s, t) => s + Number(t.charge_amount ?? 0) - Number(t.discount_amount ?? 0), 0);
  const collected = (paid.data ?? []).reduce((s, t) => s + Number(t.grand_total ?? 0), 0);
  const bookingCount = (bookings.data ?? []).length;
  const leadCount = (leads.data ?? []).length;

  const spendRows = spend.data ?? [];
  const byPlatform = spendRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.platform_key as string] = (acc[r.platform_key as string] ?? 0) + Number(r.spend ?? 0);
    return acc;
  }, {});

  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  const parts = [
    `Window: last 90 days (${from} to ${to}).`,
    `Bookings: ${bookingCount}.`,
    `Revenue sold: ${money(revenue)} (charges less discounts on retreat line items).`,
    `Cash collected: ${money(collected)} (payments received; payouts to leaders excluded).`,
    leadCount
      ? `Leads: ${leadCount}.`
      : 'Leads: 0 in this window. Every lead on record came from one Retreat Guru import and carries no campaign tag, so cost per lead cannot be calculated.',
    spendRows.length
      ? `Ad spend by platform: ${Object.entries(byPlatform).map(([k, v]) => `${k} ${money(v)}`).join(', ')}.`
      : 'Ad spend: NO ad platform is connected yet, so spend, cost per lead, cost per booking and ROAS cannot be calculated. Say so if asked.',
    'Lead attribution: UTM tags are not yet captured, so leads cannot be traced to a campaign yet.',
  ];

  if ((goals.data ?? []).length) {
    parts.push(
      'Campaign goals:\n' +
        (goals.data ?? []).map((g) => {
          const targets = [
            g.target_spend ? `spend ${money(Number(g.target_spend))}` : null,
            g.target_leads ? `leads ${g.target_leads}` : null,
            g.target_bookings ? `bookings ${g.target_bookings}` : null,
            g.target_revenue ? `revenue ${money(Number(g.target_revenue))}` : null,
            g.target_roas ? `ROAS ${g.target_roas}x` : null,
          ].filter(Boolean).join(', ');
          const scope = [
            g.platform_key ?? 'all platforms',
            g.period_start || g.period_end ? `${g.period_start ?? '?'} to ${g.period_end ?? '?'}` : null,
          ].filter(Boolean).join(', ');
          return `- ${g.title} (${scope})${targets ? `\n  Targets: ${targets}` : ''}${g.body ? `\n  Brief: ${g.body}` : ''}`;
        }).join('\n'),
    );
  } else {
    parts.push('Campaign goals: none set yet. Suggest setting some if the question calls for it.');
  }

  const knowledge = (knowledgeRows.data ?? []).length
    ? (knowledgeRows.data ?? []).map((n) => `## ${n.title} [${n.topic}]\n${n.body}`).join('\n\n')
    : 'No knowledge base entries are loaded. Rely on general advertising practice and say so.';

  return { knowledge, live: parts.join('\n\n') };
}
