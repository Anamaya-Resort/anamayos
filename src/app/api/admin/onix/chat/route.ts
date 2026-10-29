import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/onix/chat — 0N1X-2, the marketing advisor.
 *
 * Context is assembled server-side so live figures, campaign goals and
 * the advertising knowledge base never have to travel through the
 * browser. Runs on Claude via ANTHROPIC_API_KEY.
 */
const MODEL = 'claude-sonnet-4-6';

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

  const context = await buildContext();

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
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: `${PERSONA}\n\n---\nLIVE CONTEXT\n${context}`,
        messages,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      return Response.json({ error: `AI error ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as { content?: { text?: string }[] };
    const reply = (data.content ?? []).map((b) => b.text ?? '').join('').trim();

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

/** Live figures + goals + knowledge, trimmed to keep the prompt small. */
async function buildContext(): Promise<string> {
  const sb = createServiceClient();
  const today = new Date();
  const from = new Date(today.getTime() - 89 * 86400000).toISOString().slice(0, 10);

  const [txns, bookings, spend, goals, knowledge] = await Promise.all([
    sb.from('transactions').select('grand_total').gte('trans_date', from),
    sb.from('bookings').select('id').gte('created_at', from),
    sb.from('ad_spend_daily').select('platform_key, spend').gte('stat_date', from),
    sb.from('marketing_goals').select('title, platform_key, target_spend, target_bookings, target_roas, body').eq('is_active', true).limit(20),
    sb.from('onix_knowledge').select('title, topic, body').eq('is_active', true).order('sort_order').limit(40),
  ]);

  const revenue = (txns.data ?? []).reduce((s, t) => s + Number(t.grand_total ?? 0), 0);
  const spendRows = spend.data ?? [];
  const byPlatform = spendRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.platform_key as string] = (acc[r.platform_key as string] ?? 0) + Number(r.spend ?? 0);
    return acc;
  }, {});

  const parts = [
    `Window: last 90 days (${from} to today).`,
    `Bookings: ${(bookings.data ?? []).length}.`,
    `Revenue: $${Math.round(revenue).toLocaleString('en-US')}.`,
    spendRows.length
      ? `Ad spend by platform: ${Object.entries(byPlatform).map(([k, v]) => `${k} $${Math.round(v)}`).join(', ')}.`
      : 'Ad spend: NO ad platform is connected yet, so spend, cost per lead, cost per booking and ROAS cannot be calculated. Say so if asked.',
    'Lead attribution: UTM tags are not yet captured, so leads cannot be traced to a campaign yet.',
  ];

  if ((goals.data ?? []).length) {
    parts.push(
      'Campaign goals:\n' +
        (goals.data ?? [])
          .map((g) => `- ${g.title}${g.platform_key ? ` (${g.platform_key})` : ''}: ${g.body ?? ''}`.trim())
          .join('\n'),
    );
  }
  if ((knowledge.data ?? []).length) {
    parts.push(
      'Advertising knowledge base:\n' +
        (knowledge.data ?? []).map((n) => `## ${n.title} [${n.topic}]\n${n.body}`).join('\n\n'),
    );
  }
  return parts.join('\n\n');
}
