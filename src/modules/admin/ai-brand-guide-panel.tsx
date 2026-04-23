'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AiProvider } from './ai-provider-card';

interface BrandGuide {
  voice_tone: string;
  messaging_points: string[];
  usps: string[];
  personality_traits: string[];
  dos_and_donts: { dos: string[]; donts: string[] };
  compiled_context: string;
}

const EMPTY_GUIDE: BrandGuide = {
  voice_tone: '',
  messaging_points: [],
  usps: [],
  personality_traits: [],
  dos_and_donts: { dos: [], donts: [] },
  compiled_context: '',
};

interface Props {
  orgId: string;
  providers: AiProvider[];
}

export function AiBrandGuidePanel({ orgId, providers }: Props) {
  const [guide, setGuide] = useState<BrandGuide>(EMPTY_GUIDE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-5.4');

  useEffect(() => {
    fetch(`/api/admin/ai/brand-guide?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.guide) {
          // Ensure JSONB fields are never null (Supabase can return null for empty columns)
          setGuide({
            voice_tone: d.guide.voice_tone ?? '',
            messaging_points: d.guide.messaging_points ?? [],
            usps: d.guide.usps ?? [],
            personality_traits: d.guide.personality_traits ?? [],
            dos_and_donts: d.guide.dos_and_donts ?? { dos: [], donts: [] },
            compiled_context: d.guide.compiled_context ?? '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await fetch('/api/admin/ai/brand-guide', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, ...guide }),
    });
    setSaving(false);
  }, [orgId, guide]);

  const handleCompile = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          system: 'You are a branding expert. Generate a concise brand context document that an AI can use as a system prompt when writing content for this brand. Output plain text, no markdown.',
          prompt: `Brand voice/tone: ${guide.voice_tone}\n\nKey messaging: ${guide.messaging_points.join(', ')}\n\nUSPs: ${guide.usps.join(', ')}\n\nPersonality: ${guide.personality_traits.join(', ')}\n\nDo's: ${guide.dos_and_donts.dos.join(', ')}\nDon'ts: ${guide.dos_and_donts.donts.join(', ')}\n\nCompile all of the above into a single cohesive brand context paragraph (200-300 words) that can be injected as a system prompt for AI content generation.`,
        }),
      });
      const data = await res.json();
      if (data.result) setGuide((prev) => ({ ...prev, compiled_context: data.result }));
    } finally {
      setGenerating(false);
    }
  }, [selectedProvider, selectedModel, guide]);

  const activeProviders = providers.filter((p) => p.has_key);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Voice & Tone */}
      <FieldSection label="Brand Voice & Tone">
        <textarea
          value={guide.voice_tone}
          onChange={(e) => setGuide((p) => ({ ...p, voice_tone: e.target.value }))}
          placeholder="Describe your brand's voice and tone (e.g., warm, expert, approachable, inspiring...)"
          className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 min-h-[80px] resize-y"
        />
      </FieldSection>

      {/* Messaging Points */}
      <StringListField
        label="Key Messaging Points"
        items={guide.messaging_points}
        onChange={(items) => setGuide((p) => ({ ...p, messaging_points: items }))}
        placeholder="Add a key message..."
      />

      {/* USPs */}
      <StringListField
        label="Unique Selling Propositions"
        items={guide.usps}
        onChange={(items) => setGuide((p) => ({ ...p, usps: items }))}
        placeholder="Add a USP..."
      />

      {/* Personality Traits */}
      <StringListField
        label="Brand Personality Traits"
        items={guide.personality_traits}
        onChange={(items) => setGuide((p) => ({ ...p, personality_traits: items }))}
        placeholder="Add a trait..."
      />

      {/* Do's and Don'ts */}
      <div className="grid grid-cols-2 gap-3">
        <StringListField
          label="Do's"
          items={guide.dos_and_donts.dos}
          onChange={(dos) => setGuide((p) => ({ ...p, dos_and_donts: { ...p.dos_and_donts, dos } }))}
          placeholder="Add a do..."
        />
        <StringListField
          label="Don'ts"
          items={guide.dos_and_donts.donts}
          onChange={(donts) => setGuide((p) => ({ ...p, dos_and_donts: { ...p.dos_and_donts, donts } }))}
          placeholder="Add a don't..."
        />
      </div>

      {/* Compiled Context */}
      <FieldSection label="Compiled AI Context">
        <div className="flex gap-2 mb-2">
          <ProviderModelSelect
            providers={providers}
            activeProviders={activeProviders}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onProviderChange={setSelectedProvider}
            onModelChange={setSelectedModel}
          />
          <Button size="sm" variant="outline" onClick={handleCompile} disabled={generating}>
            {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Generate
          </Button>
        </div>
        <textarea
          value={guide.compiled_context}
          onChange={(e) => setGuide((p) => ({ ...p, compiled_context: e.target.value }))}
          placeholder="Click Generate to compile your brand guide into an AI-ready context block..."
          className="w-full rounded border bg-muted/30 px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 min-h-[120px] resize-y"
        />
      </FieldSection>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
        Save Brand Guide
      </Button>
    </div>
  );
}

// ── Shared sub-components ──

function FieldSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function StringListField({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (items: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft('');
  };
  return (
    <FieldSection label={label}>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs">
            {item}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
        />
        <Button size="sm" variant="ghost" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </FieldSection>
  );
}

/** Provider/model selector with greyed-out inactive providers */
export function ProviderModelSelect({ providers, activeProviders, selectedProvider, selectedModel, onProviderChange, onModelChange }: {
  providers: AiProvider[];
  activeProviders: AiProvider[];
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
}) {
  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const llms = currentProvider?.models.filter((m) => m.type === 'llm' && m.active) ?? [];

  return (
    <div className="flex gap-1.5">
      <select
        value={selectedProvider}
        onChange={(e) => {
          onProviderChange(e.target.value);
          const p = providers.find((pr) => pr.id === e.target.value);
          const firstLlm = p?.models.find((m) => m.type === 'llm' && m.active);
          if (firstLlm) onModelChange(firstLlm.endpoint);
        }}
        className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
      >
        {providers.map((p) => {
          const isActive = activeProviders.some((a) => a.id === p.id);
          return (
            <option key={p.id} value={p.id} disabled={!isActive}>
              {p.display_name}{!isActive ? ' (No Key)' : ''}
            </option>
          );
        })}
      </select>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
      >
        {llms.map((m) => (
          <option key={m.id} value={m.endpoint}>{m.name}</option>
        ))}
      </select>
    </div>
  );
}
