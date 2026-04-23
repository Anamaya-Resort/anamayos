import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/ai/test
 * Tests a specific model with a prompt. Returns the model's response.
 * Body: { provider: string, model: string, prompt: string }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { provider: string; model: string; prompt: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider, model, prompt } = body;
  if (!provider || !model || !prompt) {
    return Response.json({ error: 'Missing provider, model, or prompt' }, { status: 400 });
  }

  try {
    const result = await callProvider(provider, model, prompt);

    // Update connection status and last tested timestamp
    const supabase = createServiceClient();
    await supabase.from('ai_providers').update({
      is_connected: true,
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', provider);

    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 502 });
  }
}

/** Dispatch a text prompt to the correct provider API */
async function callProvider(provider: string, model: string, prompt: string): Promise<string> {
  switch (provider) {
    case 'openai':
    case 'xai':
      return callOpenAICompatible(provider, model, prompt);
    case 'anthropic':
      return callAnthropic(model, prompt);
    case 'google':
      return callGoogle(model, prompt);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/** OpenAI-compatible API (works for OpenAI and xAI/Grok) */
async function callOpenAICompatible(provider: string, model: string, prompt: string): Promise<string> {
  const key = provider === 'xai' ? process.env.XAI_API_KEY : process.env.OPENAI_API_KEY;
  const baseUrl = provider === 'xai' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1';
  if (!key) throw new Error(`No API key configured for ${provider}`);

  // OpenAI now requires max_completion_tokens for all newer models (gpt-5.x, o-series)
  // xAI/Grok still uses the older max_tokens parameter
  const tokenParam = provider === 'openai' ? { max_completion_tokens: 1024 } : { max_tokens: 1024 };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...tokenParam,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${provider} API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '(no response)';
}

/** Anthropic Messages API */
async function callAnthropic(model: string, prompt: string): Promise<string> {
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
      max_tokens: 1024,
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

/** Google Gemini API */
async function callGoogle(model: string, prompt: string): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error('No API key configured for Google');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no response)';
}
