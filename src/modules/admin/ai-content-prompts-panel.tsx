'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProviderModelSelect } from './ai-brand-guide-panel';
import type { AiProvider } from './ai-provider-card';

const CATEGORIES = [
  { value: 'article', label: 'Article' },
  { value: 'ad_copy', label: 'Ad Copy' },
  { value: 'video_script', label: 'Video Script' },
  { value: 'ab_test', label: 'A/B Test' },
  { value: 'schema', label: 'Schema Markup' },
] as const;

interface ContentPrompt {
  id: string;
  name: string;
  category: string;
  system_prompt: string;
  user_prompt_template: string;
  target_archetype_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Archetype {
  id: string;
  name: string;
}

interface Props {
  orgId: string;
  providers: AiProvider[];
}

export function AiContentPromptsPanel({ orgId, providers }: Props) {
  const [prompts, setPrompts] = useState<ContentPrompt[]>([]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('article');

  const activeProviders = providers.filter((p) => p.has_key);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/ai/content-prompts?orgId=${orgId}`).then((r) => r.json()),
      fetch(`/api/admin/ai/archetypes?orgId=${orgId}`).then((r) => r.json()),
    ]).then(([promptData, archData]) => {
      setPrompts(promptData.prompts ?? []);
      setArchetypes(archData.archetypes ?? []);
      setLoading(false);
    });
  }, [orgId]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch('/api/admin/ai/content-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, name: newName.trim(), category: newCategory, sort_order: prompts.length }),
    });
    const data = await res.json();
    if (data.prompt) {
      setPrompts((prev) => [...prev, data.prompt]);
      setExpandedId(data.prompt.id);
    }
    setNewName('');
    setCreating(false);
  }, [orgId, newName, newCategory, prompts.length]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/admin/ai/content-prompts?id=${id}`, { method: 'DELETE' });
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const handleUpdate = useCallback((id: string, updates: Partial<ContentPrompt>) => {
    setPrompts((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
    if (saveTimerRef.current[id]) clearTimeout(saveTimerRef.current[id]);
    saveTimerRef.current[id] = setTimeout(async () => {
      await fetch('/api/admin/ai/content-prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
    }, 500);
  }, []);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-2">
      {prompts.map((prompt) => (
        <PromptCard
          key={prompt.id}
          prompt={prompt}
          archetypes={archetypes}
          expanded={expandedId === prompt.id}
          onToggle={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          providers={providers}
          activeProviders={activeProviders}
        />
      ))}

      {/* Add new */}
      <div className="flex gap-2 pt-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          placeholder="New template name..." className="flex-1 rounded border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
          className="rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50">
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          Add
        </Button>
      </div>
    </div>
  );
}

function PromptCard({ prompt, archetypes, expanded, onToggle, onUpdate, onDelete, providers, activeProviders }: {
  prompt: ContentPrompt;
  archetypes: Archetype[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: Partial<ContentPrompt>) => void;
  onDelete: (id: string) => void;
  providers: AiProvider[];
  activeProviders: AiProvider[];
}) {
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-5.4');

  const catLabel = CATEGORIES.find((c) => c.value === prompt.category)?.label ?? prompt.category;

  const handleTest = async () => {
    setTesting(true);
    setTestOutput('');
    try {
      const res = await fetch('/api/admin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          system: prompt.system_prompt,
          prompt: prompt.user_prompt_template.replace(/\{\{(\w+)\}\}/g, '[SAMPLE_$1]'),
        }),
      });
      const data = await res.json();
      setTestOutput(data.result ?? data.error ?? 'No response');
    } catch (err) {
      setTestOutput(err instanceof Error ? err.message : 'Test failed');
    }
    setTesting(false);
  };

  return (
    <div className="border rounded-lg bg-card">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-lg">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-sm font-medium">{prompt.name}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{catLabel}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(prompt.id); }} className="text-muted-foreground hover:text-destructive p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-3">
          {/* Category + Archetype */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
              <select value={prompt.category} onChange={(e) => onUpdate(prompt.id, { category: e.target.value })}
                className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 mt-0.5">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Target Archetype</label>
              <select value={prompt.target_archetype_id ?? ''} onChange={(e) => onUpdate(prompt.id, { target_archetype_id: e.target.value || null })}
                className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 mt-0.5">
                <option value="">Any / None</option>
                {archetypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">System Prompt</label>
            <textarea value={prompt.system_prompt} onChange={(e) => onUpdate(prompt.id, { system_prompt: e.target.value })}
              placeholder="Instructions for the AI's role and behavior..."
              className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 min-h-[60px] resize-y mt-0.5" />
          </div>

          {/* User Prompt Template */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              User Prompt Template <span className="font-normal text-muted-foreground/70">{'(use {{variable}} for placeholders)'}</span>
            </label>
            <textarea value={prompt.user_prompt_template} onChange={(e) => onUpdate(prompt.id, { user_prompt_template: e.target.value })}
              placeholder="Write a {{content_type}} about {{topic}} targeting {{archetype}}..."
              className="w-full rounded border bg-background px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 min-h-[80px] resize-y mt-0.5" />
          </div>

          {/* Test */}
          <div className="flex items-center gap-2">
            <ProviderModelSelect
              providers={providers} activeProviders={activeProviders}
              selectedProvider={selectedProvider} selectedModel={selectedModel}
              onProviderChange={setSelectedProvider} onModelChange={setSelectedModel}
            />
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              Test
            </Button>
          </div>
          {testOutput && (
            <div className="rounded border bg-muted/30 px-3 py-2 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
              {testOutput}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
