'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProviderModelSelect } from './ai-brand-guide-panel';
import type { AiProvider } from './ai-provider-card';

interface Archetype {
  id: string;
  name: string;
  description: string;
  demographics: Record<string, string>;
  motivations: string[];
  pain_points: string[];
  content_tone: string;
  sample_messaging: string[];
  sort_order: number;
  is_active: boolean;
}

interface Props {
  orgId: string;
  providers: AiProvider[];
}

export function AiArchetypesPanel({ orgId, providers }: Props) {
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const activeProviders = providers.filter((p) => p.has_key);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/ai/archetypes?orgId=${orgId}`);
    const data = await res.json();
    setArchetypes(data.archetypes ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch('/api/admin/ai/archetypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, name: newName.trim(), sort_order: archetypes.length }),
    });
    const data = await res.json();
    if (data.archetype) {
      setArchetypes((prev) => [...prev, data.archetype]);
      setExpandedId(data.archetype.id);
    }
    setNewName('');
    setCreating(false);
  }, [orgId, newName, archetypes.length]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/admin/ai/archetypes?id=${id}`, { method: 'DELETE' });
    setArchetypes((prev) => prev.filter((a) => a.id !== id));
    if (expandedId === id) setExpandedId(null);
  }, [expandedId]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Archetype>) => {
    setArchetypes((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
    await fetch('/api/admin/ai/archetypes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
  }, []);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-2">
      {archetypes.map((arch) => (
        <ArchetypeCard
          key={arch.id}
          archetype={arch}
          expanded={expandedId === arch.id}
          onToggle={() => setExpandedId(expandedId === arch.id ? null : arch.id)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          providers={providers}
          activeProviders={activeProviders}
          orgId={orgId}
        />
      ))}

      {/* Add new */}
      <div className="flex gap-2 pt-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          placeholder="New archetype name..."
          className="flex-1 rounded border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
        />
        <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          Add
        </Button>
      </div>
    </div>
  );
}

function ArchetypeCard({ archetype: arch, expanded, onToggle, onUpdate, onDelete, providers, activeProviders, orgId }: {
  archetype: Archetype;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: Partial<Archetype>) => void;
  onDelete: (id: string) => void;
  providers: AiProvider[];
  activeProviders: AiProvider[];
  orgId: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-5.4');

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          system: 'You are a marketing strategist for a luxury wellness retreat in Costa Rica. Generate detailed customer archetype data as JSON.',
          prompt: `Generate a detailed customer archetype for "${arch.name}" with this description: "${arch.description || arch.name}".

Return a JSON object with these exact keys:
- "description": 2-3 sentence summary (string)
- "demographics": object with keys "age_range", "income_level", "education", "location"
- "motivations": array of 4-6 motivation strings
- "pain_points": array of 4-6 pain point strings
- "content_tone": string describing ideal content tone
- "sample_messaging": array of 3-4 sample marketing messages

Return ONLY the JSON, no markdown fences.`,
        }),
      });
      const data = await res.json();
      if (data.result) {
        let cleaned = data.result.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(cleaned);
        onUpdate(arch.id, {
          description: parsed.description ?? arch.description,
          demographics: parsed.demographics ?? arch.demographics,
          motivations: parsed.motivations ?? arch.motivations,
          pain_points: parsed.pain_points ?? arch.pain_points,
          content_tone: parsed.content_tone ?? arch.content_tone,
          sample_messaging: parsed.sample_messaging ?? arch.sample_messaging,
        });
      }
    } catch { /* generation failed silently */ }
    setGenerating(false);
  };

  return (
    <div className="border rounded-lg bg-card">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-lg">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-sm font-medium">{arch.name}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(arch.id); }} className="text-muted-foreground hover:text-destructive p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-3">
          {/* Description */}
          <Field label="Description">
            <textarea value={arch.description} onChange={(e) => onUpdate(arch.id, { description: e.target.value })}
              placeholder="Describe this archetype..." className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 min-h-[60px] resize-y" />
          </Field>

          {/* Content Tone */}
          <Field label="Content Tone">
            <input value={arch.content_tone} onChange={(e) => onUpdate(arch.id, { content_tone: e.target.value })}
              placeholder="e.g., warm and inspiring, evidence-based..." className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>

          {/* Motivations */}
          <Field label="Motivations">
            <TagList items={arch.motivations} onChange={(motivations) => onUpdate(arch.id, { motivations })} placeholder="Add motivation..." />
          </Field>

          {/* Pain Points */}
          <Field label="Pain Points">
            <TagList items={arch.pain_points} onChange={(pain_points) => onUpdate(arch.id, { pain_points })} placeholder="Add pain point..." />
          </Field>

          {/* Sample Messaging */}
          <Field label="Sample Messaging">
            <TagList items={arch.sample_messaging} onChange={(sample_messaging) => onUpdate(arch.id, { sample_messaging })} placeholder="Add sample message..." />
          </Field>

          {/* AI Generate */}
          <div className="flex items-center gap-2 pt-1">
            <ProviderModelSelect
              providers={providers} activeProviders={activeProviders}
              selectedProvider={selectedProvider} selectedModel={selectedModel}
              onProviderChange={setSelectedProvider} onModelChange={setSelectedModel}
            />
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
              AI Fill
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function TagList({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  return (
    <>
      <div className="flex flex-wrap gap-1 mb-1">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]">
            {item}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); onChange([...items, draft.trim()]); setDraft(''); } }}
          placeholder={placeholder} className="flex-1 rounded border bg-background px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary/50" />
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(''); } }}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </>
  );
}
