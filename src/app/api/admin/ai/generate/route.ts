import { getSession } from '@/lib/session';

/**
 * POST /api/admin/ai/generate
 * General-purpose AI generation endpoint. Sends a system+user prompt to the
 * selected provider/model and returns the text response.
 * Body: { provider: string, model: string, system: string, prompt: string }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { provider: string; model: string; system?: string; prompt: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider, model, system, prompt } = body;
  if (!provider || !model || !prompt) {
    return Response.json({ error: 'Missing provider, model, or prompt' }, { status: 400 });
  }

  try {
    const result = await callProvider(provider, model, system ?? '', prompt);
    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 502 });
  }
}

async function callProvider(provider: string, model: string, system: string, prompt: string): Promise<string> {
  switch (provider) {
    case 'openai':
    case 'xai':
      return callOpenAICompatible(provider, model, system, prompt);
    case 'anthropic':
      return callAnthropic(model, system, prompt);
    case 'google':
      return callGoogle(model, system, prompt);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOpenAICompatible(provider: string, model: string, system: string, prompt: string): Promise<string> {
  const key = provider === 'xai' ? process.env.XAI_API_KEY : process.env.OPENAI_API_KEY;
  const baseUrl = provider === 'xai' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1';
  if (!key) throw new Error(`No API key configured for ${provider}`);

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const tokenParam = provider === 'openai' ? { max_completion_tokens: 4096 } : { max_tokens: 4096 };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, ...tokenParam }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${provider} API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '(no response)';
}

async function callAnthropic(model: string, system: string, prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No API key configured for Anthropic');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
  return textBlock?.text ?? '(no response)';
}

async function callGoogle(model: string, system: string, prompt: string): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error('No API key configured for Google');

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (system) contents.push({ role: 'user', parts: [{ text: system }] }, { role: 'model', parts: [{ text: 'Understood.' }] });
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no response)';
}
