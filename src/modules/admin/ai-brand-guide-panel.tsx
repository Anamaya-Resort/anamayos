'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2, Save, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { AiProvider } from './ai-provider-card';

// ── Types ──

interface BrandGuideFields {
  voice_tone: string;
  messaging_points: string[];
  usps: string[];
  personality_traits: string[];
  dos_and_donts: { dos: string[]; donts: string[] };
}

interface SavedGuide extends BrandGuideFields {
  id: string;
  name: string;
  compiled_context: string;
}

const EMPTY_FIELDS: BrandGuideFields = {
  voice_tone: '',
  messaging_points: [],
  usps: [],
  personality_traits: [],
  dos_and_donts: { dos: [], donts: [] },
};

function safeFields(raw: Record<string, unknown>): BrandGuideFields {
  return {
    voice_tone: (raw.voice_tone as string) ?? '',
    messaging_points: (raw.messaging_points as string[]) ?? [],
    usps: (raw.usps as string[]) ?? [],
    personality_traits: (raw.personality_traits as string[]) ?? [],
    dos_and_donts: (raw.dos_and_donts as { dos: string[]; donts: string[] }) ?? { dos: [], donts: [] },
  };
}

// ── Props ──

interface Props {
  orgId: string;
  providers: AiProvider[];
}

// ── AI Generation prompt ──

const AI_SYSTEM = `You are an expert brand strategist specializing in branding in 2026 — the age of artificial intelligence. Modern brands must be optimized not just for human audiences but also for AI systems that recommend, summarize, and mediate between brands and consumers. Key principles for AI-age branding:
- Brand voice must be distinctive enough for AI to differentiate from competitors
- Messaging should be structured and semantically clear for AI parsing
- USPs need concrete, verifiable claims (AI fact-checks vague promises)
- Personality traits should be consistent across all AI-generated touchpoints
- Do's/Don'ts must account for AI-generated content guardrails

Return your analysis as a JSON object with these exact keys:
- "voice_tone": string (2-3 sentences describing brand voice and tone)
- "messaging_points": array of 4-8 key messaging strings
- "usps": array of 3-6 unique selling propositions
- "personality_traits": array of 4-8 brand personality trait strings
- "dos_and_donts": object with "dos" (array of 4-6 strings) and "donts" (array of 4-6 strings)

Return ONLY the JSON, no markdown fences, no explanation.`;

export function AiBrandGuidePanel({ orgId, providers }: Props) {
  // ── State ──
  const [guides, setGuides] = useState<SavedGuide[]>([]);
  const [edited, setEdited] = useState<BrandGuideFields>(EMPTY_FIELDS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [aiGenerated, setAiGenerated] = useState<BrandGuideFields | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [compiling, setCompiling] = useState(false);

  const [brandDump, setBrandDump] = useState('');
  const [userInstructions, setUserInstructions] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-5.4');

  // Compiled context section
  const [compileGuideId, setCompileGuideId] = useState<string>('');
  const [compiledContext, setCompiledContext] = useState('');

  // Confirmation modal for overwriting editor
  const [confirmGuide, setConfirmGuide] = useState<SavedGuide | null>(null);

  const activeProviders = providers.filter((p) => p.has_key);
  const compileGuideIdRef = useRef(compileGuideId);
  compileGuideIdRef.current = compileGuideId;

  // ── Load guides ──
  const loadGuides = useCallback(async () => {
    const res = await fetch(`/api/admin/ai/brand-guide?orgId=${orgId}`);
    const data = await res.json();
    const safe = (data.guides ?? []).map((g: Record<string, unknown>) => ({
      ...g,
      ...safeFields(g),
      compiled_context: (g.compiled_context as string) ?? '',
    })) as SavedGuide[];
    setGuides(safe);
    // Auto-select first guide for compile dropdown if none selected
    if (safe.length > 0 && !compileGuideIdRef.current) setCompileGuideId(safe[0].id);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadGuides(); }, [loadGuides]);

  // ── Check if editor has content ──
  const editorHasContent = edited.voice_tone.trim() !== '' || edited.messaging_points.length > 0
    || edited.usps.length > 0 || edited.personality_traits.length > 0
    || edited.dos_and_donts.dos.length > 0 || edited.dos_and_donts.donts.length > 0;

  // ── Load a saved guide into the left editor (with confirmation if needed) ──
  const requestLoadIntoEditor = useCallback((guide: SavedGuide) => {
    if (editorHasContent && editingId !== guide.id) {
      setConfirmGuide(guide);
    } else {
      setEdited(safeFields(guide as unknown as Record<string, unknown>));
      setEditingId(guide.id);
      setEditingName(guide.name);
    }
  }, [editorHasContent, editingId]);

  const confirmLoadIntoEditor = useCallback(() => {
    if (!confirmGuide) return;
    setEdited(safeFields(confirmGuide as unknown as Record<string, unknown>));
    setEditingId(confirmGuide.id);
    setEditingName(confirmGuide.name);
    setConfirmGuide(null);
  }, [confirmGuide]);

  // ── Save & Name ──
  const handleSave = useCallback(async () => {
    if (!editingName.trim()) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      org_id: orgId,
      name: editingName.trim(),
      ...edited,
      compiled_context: '',
    };
    if (editingId) body.id = editingId;

    const res = await fetch('/api/admin/ai/brand-guide', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.guide) {
      setEditingId(data.guide.id);
      await loadGuides();
    }
    setSaving(false);
  }, [orgId, editingId, editingName, edited, loadGuides]);

  // ── Delete a guide ──
  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/admin/ai/brand-guide?id=${id}`, { method: 'DELETE' });
    if (editingId === id) { setEditingId(null); setEditingName(''); setEdited(EMPTY_FIELDS); }
    await loadGuides();
  }, [editingId, loadGuides]);

  // ── AI Generate from text dump ──
  const handleGenerate = useCallback(async () => {
    if (!brandDump.trim()) return;
    setGenerating(true);
    setAiGenerated(null);
    try {
      const userPrompt = `Here is everything about this brand/company:\n\n${brandDump}\n\n${userInstructions ? `Additional instructions from the user:\n${userInstructions}\n\n` : ''}Analyze this information and create a comprehensive brand guide optimized for AI-age branding in 2026.`;
      const res = await fetch('/api/admin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, model: selectedModel, system: AI_SYSTEM, prompt: userPrompt }),
      });
      const data = await res.json();
      if (data.result) {
        let cleaned = data.result.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(cleaned);
        setAiGenerated(safeFields(parsed));
      }
    } catch { /* parse failure */ }
    setGenerating(false);
  }, [brandDump, userInstructions, selectedProvider, selectedModel]);

  // ── Transfer AI → Editor ──
  const handleTransfer = useCallback(() => {
    if (!aiGenerated) return;
    setEdited(aiGenerated);
  }, [aiGenerated]);

  // ── Compile context from a saved guide ──
  const handleCompile = useCallback(async () => {
    const guide = guides.find((g) => g.id === compileGuideId);
    if (!guide) return;
    setCompiling(true);
    try {
      const res = await fetch('/api/admin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          system: 'You are a branding expert. Generate a concise brand context document (200-300 words) that an AI can use as a system prompt when writing content for this brand. Consider modern AI-age branding principles. Output plain text, no markdown.',
          prompt: `Brand voice/tone: ${guide.voice_tone}\n\nKey messaging: ${guide.messaging_points.join(', ')}\n\nUSPs: ${guide.usps.join(', ')}\n\nPersonality: ${guide.personality_traits.join(', ')}\n\nDo's: ${guide.dos_and_donts.dos.join(', ')}\nDon'ts: ${guide.dos_and_donts.donts.join(', ')}\n\nCompile all of the above into a single cohesive brand context paragraph that can be injected as a system prompt for AI content generation.`,
        }),
      });
      const data = await res.json();
      if (data.result) {
        setCompiledContext(data.result);
        // Also save compiled_context back to the guide
        await fetch('/api/admin/ai/brand-guide', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: guide.id, org_id: orgId, name: guide.name, ...safeFields(guide as unknown as Record<string, unknown>), compiled_context: data.result }),
        });
        await loadGuides();
      }
    } finally {
      setCompiling(false);
    }
  }, [guides, compileGuideId, selectedProvider, selectedModel, orgId, loadGuides]);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      {/* Saved Brand Guides — full-width cards */}
      {guides.length > 0 && (
        <div className="border rounded-lg p-4 bg-card space-y-3">
          <h4 className="text-sm font-semibold">Saved Brand Guides</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {guides.map((g) => {
              const isActive = editingId === g.id;
              return (
                <div key={g.id}
                  className={`relative border rounded-lg p-3 cursor-pointer transition-colors ${isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                  onClick={() => requestLoadIntoEditor(g)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{g.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {g.voice_tone || 'No voice/tone set'}
                        </p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}
                      className="text-muted-foreground hover:text-destructive p-1 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {g.messaging_points.slice(0, 3).map((mp, i) => (
                      <span key={i} className="rounded-[8px] bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{mp}</span>
                    ))}
                    {g.messaging_points.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{g.messaging_points.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overwrite confirmation modal */}
      <Dialog open={!!confirmGuide} onOpenChange={(open) => { if (!open) setConfirmGuide(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Overwrite Editor?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will overwrite what you have in the Manual Editor with &ldquo;{confirmGuide?.name}&rdquo;.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmGuide(null)}>No, Keep Current</Button>
            <Button onClick={confirmLoadIntoEditor}>Yes, Load Guide</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ROW 1: Two-column — Edited (left) + AI Preview (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: Manually Edited Brand Guide */}
        <div className="space-y-3 border rounded-lg p-4 bg-card">
          <h4 className="text-sm font-semibold">Manually Edited Brand Guide</h4>

          <FieldSection label="Brand Voice & Tone">
            <textarea value={edited.voice_tone} onChange={(e) => setEdited((p) => ({ ...p, voice_tone: e.target.value }))}
              placeholder="Describe your brand's voice and tone..."
              className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground/90 outline-none focus:ring-1 focus:ring-primary/50 min-h-[120px] resize-y" />
          </FieldSection>

          <StringListField label="Key Messaging" items={edited.messaging_points}
            onChange={(items) => setEdited((p) => ({ ...p, messaging_points: items }))} placeholder="Add message..." />

          <StringListField label="USPs" items={edited.usps}
            onChange={(items) => setEdited((p) => ({ ...p, usps: items }))} placeholder="Add USP..." />

          <StringListField label="Personality Traits" items={edited.personality_traits}
            onChange={(items) => setEdited((p) => ({ ...p, personality_traits: items }))} placeholder="Add trait..." />

          <div className="grid grid-cols-2 gap-2">
            <StringListField label="Do's" items={edited.dos_and_donts.dos}
              onChange={(dos) => setEdited((p) => ({ ...p, dos_and_donts: { ...p.dos_and_donts, dos } }))} placeholder="Add do..." />
            <StringListField label="Don'ts" items={edited.dos_and_donts.donts}
              onChange={(donts) => setEdited((p) => ({ ...p, dos_and_donts: { ...p.dos_and_donts, donts } }))} placeholder="Add don't..." />
          </div>

          {/* Save & Name */}
          <div className="flex gap-2 pt-1">
            <input value={editingName} onChange={(e) => setEditingName(e.target.value)}
              placeholder="Name this guide..."
              className="flex-1 rounded border bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50" />
            <Button size="sm" onClick={handleSave} disabled={saving || !editingName.trim()}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              {editingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>

        {/* RIGHT: AI-Generated Brand Guide — same field layout as left, read-only */}
        <div className="space-y-3 border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">AI-Generated Brand Guide</h4>
            {aiGenerated && (
              <Button size="sm" onClick={handleTransfer}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Transfer to Editor
              </Button>
            )}
          </div>

          {aiGenerated ? (
            <>
              <FieldSection label="Brand Voice & Tone">
                <textarea value={aiGenerated.voice_tone} readOnly
                  className="w-full rounded border bg-muted/20 px-3 py-2 text-sm text-foreground/90 outline-none min-h-[120px] resize-y cursor-default" />
              </FieldSection>

              <ReadOnlyTagList label="Key Messaging" items={aiGenerated.messaging_points} />
              <ReadOnlyTagList label="USPs" items={aiGenerated.usps} />
              <ReadOnlyTagList label="Personality Traits" items={aiGenerated.personality_traits} />

              <div className="grid grid-cols-2 gap-2">
                <ReadOnlyTagList label="Do's" items={aiGenerated.dos_and_donts.dos} />
                <ReadOnlyTagList label="Don'ts" items={aiGenerated.dos_and_donts.donts} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              {generating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Generating brand guide...</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Use the generator below to create an AI brand guide.<br />Results will appear here in the same format as the editor.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: Full-width AI Generator ── */}
      <div className="border rounded-lg p-4 bg-card space-y-3">
        <h4 className="text-sm font-semibold">Generate Brand Guide with AI</h4>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FieldSection label="Brand Info Dump">
            <textarea value={brandDump} onChange={(e) => setBrandDump(e.target.value)}
              placeholder="Paste everything about your brand here — website copy, mission statement, values, target market, history, product descriptions, competitor positioning, anything relevant..."
              className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground/90 outline-none focus:ring-1 focus:ring-primary/50 min-h-[240px] resize-y" />
          </FieldSection>

          <FieldSection label="Instructions for AI">
            <textarea value={userInstructions} onChange={(e) => setUserInstructions(e.target.value)}
              placeholder="Optional: focus on a specific market, type of client, tone preference, or any other direction for the brand guide..."
              className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground/90 outline-none focus:ring-1 focus:ring-primary/50 min-h-[240px] resize-y" />
          </FieldSection>
        </div>

        <div className="flex gap-2">
          <ProviderModelSelect providers={providers} activeProviders={activeProviders}
            selectedProvider={selectedProvider} selectedModel={selectedModel}
            onProviderChange={setSelectedProvider} onModelChange={setSelectedModel} />
          <Button size="sm" onClick={handleGenerate} disabled={generating || !brandDump.trim()}>
            {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Generate Brand Guide
          </Button>
        </div>
      </div>

      {/* ── ROW 3: Compiled AI Context ── */}
      <div className="border rounded-lg p-4 bg-card space-y-3">
        <h4 className="text-sm font-semibold">Compiled AI Context</h4>
        <p className="text-[11px] text-muted-foreground">Select a saved guide and compile it into a single AI-ready system prompt.</p>
        <div className="flex gap-2">
          <select value={compileGuideId} onChange={(e) => setCompileGuideId(e.target.value)}
            className="flex-1 rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50">
            {guides.length === 0 && <option value="">No saved guides yet</option>}
            {guides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <ProviderModelSelect providers={providers} activeProviders={activeProviders}
            selectedProvider={selectedProvider} selectedModel={selectedModel}
            onProviderChange={setSelectedProvider} onModelChange={setSelectedModel} />
          <Button size="sm" variant="outline" onClick={handleCompile} disabled={compiling || !compileGuideId}>
            {compiling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Compile
          </Button>
        </div>
        <textarea value={compiledContext} onChange={(e) => setCompiledContext(e.target.value)}
          placeholder="Select a guide and click Compile to generate an AI-ready context block..."
          className="w-full rounded border bg-muted/30 px-3 py-2 text-sm font-mono text-foreground/90 outline-none focus:ring-1 focus:ring-primary/50 min-h-[200px] resize-y" />
      </div>
    </div>
  );
}

// ── Shared sub-components ──

function FieldSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** Read-only tag list that mirrors StringListField visually but without edit controls */
function ReadOnlyTagList({ label, items }: { label: string; items: string[] }) {
  return (
    <FieldSection label={label}>
      <div className="flex flex-wrap gap-1.5 min-h-[40px] items-start">
        {items.length === 0 && <span className="text-sm text-muted-foreground italic">—</span>}
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center rounded-[8px] border bg-muted/20 px-2.5 py-1 text-sm text-foreground/90">
            {item}
          </span>
        ))}
      </div>
    </FieldSection>
  );
}

function StringListField({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (items: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const add = () => { if (!draft.trim()) return; onChange([...items, draft.trim()]); setDraft(''); };
  const commitEdit = () => {
    if (editingIdx === null) return;
    if (editingText.trim()) {
      onChange(items.map((item, j) => j === editingIdx ? editingText.trim() : item));
    } else {
      onChange(items.filter((_, j) => j !== editingIdx));
    }
    setEditingIdx(null);
    setEditingText('');
  };
  const cancelEdit = () => { setEditingIdx(null); setEditingText(''); };
  return (
    <FieldSection label={label}>
      <div className="flex flex-wrap gap-1.5 mb-1.5 min-h-[40px] items-start">
        {items.map((item, i) => (
          <span key={i}
            className={`inline-flex items-center gap-1 rounded-[8px] border px-2.5 py-1 text-sm text-foreground/90 cursor-default select-none ${editingIdx === i ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-background'}`}
            onContextMenu={(e) => { e.preventDefault(); setEditingIdx(i); setEditingText(item); }}
            title="Right-click to edit">
            {item}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {editingIdx !== null && (
        <div className="mb-1.5 w-full space-y-1">
          <p className="text-[10px] text-muted-foreground">Editing item {editingIdx + 1} — Enter to save, Esc to cancel</p>
          <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { cancelEdit(); }
            }}
            autoFocus rows={3}
            className="w-full rounded-[8px] border-2 border-primary bg-background px-3 py-2 text-sm text-foreground/90 outline-none resize-none" />
        </div>
      )}
      <div className="flex gap-1.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder} className="flex-1 rounded-[8px] border bg-background px-3 py-1.5 text-sm text-foreground/90 outline-none focus:ring-1 focus:ring-primary/50" />
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={add} disabled={!draft.trim()}>
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
      <select value={selectedProvider}
        onChange={(e) => {
          onProviderChange(e.target.value);
          const p = providers.find((pr) => pr.id === e.target.value);
          const firstLlm = p?.models.find((m) => m.type === 'llm' && m.active);
          if (firstLlm) onModelChange(firstLlm.endpoint);
        }}
        className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50">
        {providers.map((p) => {
          const isActive = activeProviders.some((a) => a.id === p.id);
          return <option key={p.id} value={p.id} disabled={!isActive}>{p.display_name}{!isActive ? ' (No Key)' : ''}</option>;
        })}
      </select>
      <select value={selectedModel} onChange={(e) => onModelChange(e.target.value)}
        className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50">
        {llms.map((m) => <option key={m.id} value={m.endpoint}>{m.name}</option>)}
      </select>
    </div>
  );
}
