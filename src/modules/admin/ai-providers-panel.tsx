'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AiProviderCard, type AiModel, type AiProvider } from './ai-provider-card';

export function AiProvidersPanel() {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/providers');
      if (!res.ok) throw new Error('Failed to load providers');
      const data = await res.json();
      setProviders(data.providers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  const handleModelsUpdated = useCallback(async (providerId: string, models: AiModel[]) => {
    // Optimistic update
    setProviders((prev) => prev.map((p) => p.id === providerId ? { ...p, models } : p));
    // Persist
    await fetch('/api/admin/ai/models', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, models }),
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-1">
        <h3 className="text-base font-semibold">AI Providers</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure AI/LLM connections, test models, and scan for new releases.
        </p>
      </div>
      {providers.map((provider) => (
        <AiProviderCard
          key={provider.id}
          provider={provider}
          onModelsUpdated={handleModelsUpdated}
          onReload={loadProviders}
        />
      ))}
    </div>
  );
}
