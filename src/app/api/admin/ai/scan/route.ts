import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

interface AiModel {
  id: string;
  name: string;
  type: 'llm' | 'image' | 'video';
  endpoint: string;
  active: boolean;
  added_at: string;
}

/**
 * POST /api/admin/ai/scan
 * Asks a provider's smartest model to report its available models,
 * then tests any newly discovered ones.
 * Body: { provider: string }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { provider: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider } = body;
  if (!provider) return Response.json({ error: 'Missing provider' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: providerRow } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('id', provider)
    .single();

  if (!providerRow) return Response.json({ error: 'Provider not found' }, { status: 404 });

  const currentModels = (providerRow.models as AiModel[]) ?? [];
  const knownIds = currentModels.map((m) => m.id);

  // Build the discovery prompt
  const scanPrompt = buildScanPrompt(provider, knownIds);

  try {
    // Use the provider's smartest model to query for available models
    const smartestModel = getSmartestModel(provider);
    const responseText = await queryProvider(provider, smartestModel, scanPrompt);

    // Parse discovered models from the response
    const discovered = parseDiscoveredModels(responseText, knownIds);

    if (discovered.length === 0) {
      return Response.json({ message: 'No new models found', newModels: [] });
    }

    // Test each discovered model with a simple prompt
    const tested: AiModel[] = [];
    for (const m of discovered) {
      if (m.type !== 'llm') {
        // For non-LLM models, add as active without testing
        tested.push({ ...m, active: true, added_at: new Date().toISOString().slice(0, 10) });
        continue;
      }
      const works = await testModel(provider, m.endpoint);
      tested.push({ ...m, active: works, added_at: new Date().toISOString().slice(0, 10) });
    }

    // Merge into existing models (new ones on top)
    const merged = [...tested, ...currentModels];
    await supabase.from('ai_providers').update({
      models: merged,
      updated_at: new Date().toISOString(),
    }).eq('id', provider);

    return Response.json({ message: `Found ${tested.length} new model(s)`, newModels: tested });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed';
    return Response.json({ error: message }, { status: 502 });
  }
}

function getSmartestModel(provider: string): string {
  switch (provider) {
    case 'openai': return 'gpt-5.4';
    case 'anthropic': return 'claude-sonnet-4-6';
    case 'google': return 'gemini-2.5-flash';
    case 'xai': return 'grok-3';
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

function buildScanPrompt(provider: string, knownIds: string[]): string {
  const providerNames: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google Gemini', xai: 'xAI',
  };
  return `You are a helpful assistant. I need you to list ALL current model IDs that are available via the ${providerNames[provider] ?? provider} API for a business/paid account.

My currently known models are: ${JSON.stringify(knownIds)}

Please respond with ONLY a JSON array of objects for any models NOT in my list above. Each object should have:
- "id": a short unique identifier
- "name": human-readable display name
- "type": one of "llm", "image", or "video"
- "endpoint": the exact model ID string used in API calls

Focus on the latest and most capable models. Skip deprecated or legacy models.
If there are no new models, respond with an empty array: []

Respond with ONLY the JSON array, no markdown fences, no explanation.`;
}

function parseDiscoveredModels(text: string, knownIds: string[]): AiModel[] {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m: Record<string, unknown>) =>
        m.id && m.name && m.type && m.endpoint && !knownIds.includes(m.id as string))
      .map((m: Record<string, unknown>) => ({
        id: m.id as string,
        name: m.name as string,
        type: m.type as 'llm' | 'image' | 'video',
        endpoint: m.endpoint as string,
        active: false,
        added_at: new Date().toISOString().slice(0, 10),
      }));
  } catch {
    return [];
  }
}

/** Quick test: send "Say hello" to a model, return true if it responds */
async function testModel(provider: string, endpoint: string): Promise<boolean> {
  try {
    await queryProvider(provider, endpoint, 'Say hello in one word.');
    return true;
  } catch {
    return false;
  }
}

/** Minimal prompt call to a provider */
async function queryProvider(provider: string, model: string, prompt: string): Promise<string> {
  switch (provider) {
    case 'openai':
    case 'xai': {
      const key = provider === 'xai' ? process.env.XAI_API_KEY : process.env.OPENAI_API_KEY;
      const baseUrl = provider === 'xai' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1';
      if (!key) throw new Error(`No API key for ${provider}`);
      const isReasoningModel = /^o\d/.test(model);
      const tokenParam = isReasoningModel ? { max_completion_tokens: 1024 } : { max_tokens: 1024 };
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], ...tokenParam }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    }
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('No API key for Anthropic');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
    }
    case 'google': {
      const key = process.env.GOOGLE_AI_API_KEY;
      if (!key) throw new Error('No API key for Google');
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) },
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
