import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/** Provider connection config — maps provider ID to env var + base URL */
const PROVIDER_CONFIG: Record<string, { envKey: string; baseUrl: string }> = {
  openai:    { envKey: 'OPENAI_API_KEY',    baseUrl: 'https://api.openai.com/v1' },
  anthropic: { envKey: 'ANTHROPIC_API_KEY',  baseUrl: 'https://api.anthropic.com/v1' },
  google:    { envKey: 'GOOGLE_AI_API_KEY',  baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  xai:       { envKey: 'XAI_API_KEY',        baseUrl: 'https://api.x.ai/v1' },
};

/**
 * GET /api/admin/ai/providers
 * Returns all AI providers with models and connection status.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data: providers, error } = await supabase
    .from('ai_providers')
    .select('*')
    .order('display_name');

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Enrich with connection info (has API key configured?)
  const enriched = (providers ?? []).map((p) => {
    const cfg = PROVIDER_CONFIG[p.id];
    const hasKey = cfg ? !!process.env[cfg.envKey] : false;
    return { ...p, has_key: hasKey };
  });

  return Response.json({ providers: enriched });
}
