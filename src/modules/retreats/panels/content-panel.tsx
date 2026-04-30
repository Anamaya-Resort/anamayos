'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { RetreatData } from '../retreat-editor';

interface Props { retreat: RetreatData; onChange: (partial: Record<string, unknown>) => void; }

export function ContentPanel({ retreat, onChange }: Props) {
  const faqs = (retreat.faqs as Array<{ question: string; answer: string }>) ?? [];

  return (
    <div className="space-y-3">
        <Field label="Excerpt (short blurb for cards)">
          <textarea value={(retreat.excerpt as string) ?? ''} onChange={(e) => onChange({ excerpt: e.target.value })}
            placeholder="A brief summary shown on retreat cards..." rows={3}
            className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
        </Field>
        <Field label="Full Description">
          <textarea value={(retreat.description as string) ?? ''} onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Main retreat description..." rows={8}
            className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
        </Field>
        <Field label="What to Expect">
          <textarea value={(retreat.what_to_expect as string) ?? ''} onChange={(e) => onChange({ what_to_expect: e.target.value })}
            placeholder="Detailed section about the retreat experience..." rows={6}
            className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
        </Field>

        <TagListField label="Highlights" items={(retreat.highlights as string[]) ?? []}
          onChange={(highlights) => onChange({ highlights })} placeholder="Add a highlight..." />
        <TagListField label="What's Included" items={(retreat.what_is_included as string[]) ?? []}
          onChange={(what_is_included) => onChange({ what_is_included })} placeholder="e.g. Daily yoga, 3 meals..." />
        <TagListField label="What's Not Included" items={(retreat.what_is_not_included as string[]) ?? []}
          onChange={(what_is_not_included) => onChange({ what_is_not_included })} placeholder="e.g. Flights, travel insurance..." />

        <Field label="Prerequisites">
          <textarea value={(retreat.prerequisites as string) ?? ''} onChange={(e) => onChange({ prerequisites: e.target.value })}
            placeholder="Any requirements to attend..." rows={3}
            className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
        </Field>
        <Field label="What to Bring">
          <textarea value={(retreat.what_to_bring as string) ?? ''} onChange={(e) => onChange({ what_to_bring: e.target.value })}
            placeholder="Packing list..." rows={3}
            className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
        </Field>
        <Field label="Welcome Message (shown to confirmed guests)">
          <textarea value={(retreat.welcome_message as string) ?? ''} onChange={(e) => onChange({ welcome_message: e.target.value })}
            placeholder="A personal welcome for confirmed guests..." rows={4}
            className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
        </Field>
        <CancellationPolicyField
          value={(retreat.cancellation_policy as string) ?? ''}
          onChange={(v) => onChange({ cancellation_policy: v })}
        />

        {/* FAQs */}
        <Field label="FAQs">
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded border bg-muted/20 p-2.5 space-y-1.5">
                <div className="flex gap-2">
                  <input value={faq.question} onChange={(e) => {
                    const next = [...faqs]; next[i] = { ...faq, question: e.target.value }; onChange({ faqs: next });
                  }} placeholder="Question" className="flex-1 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0"
                    onClick={() => onChange({ faqs: faqs.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <textarea value={faq.answer} onChange={(e) => {
                  const next = [...faqs]; next[i] = { ...faq, answer: e.target.value }; onChange({ faqs: next });
                }} placeholder="Answer" rows={2}
                  className="w-full rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => onChange({ faqs: [...faqs, { question: '', answer: '' }] })} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add FAQ
            </Button>
          </div>
        </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label><div className="mt-1">{children}</div></div>);
}

function TagListField({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder: string; }) {
  const [draft, setDraft] = useState('');
  const add = () => { if (!draft.trim()) return; onChange([...items, draft.trim()]); setDraft(''); };
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5 mb-1.5 min-h-[32px] items-start">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-[8px] border bg-background px-2.5 py-1 text-sm text-foreground/90">
            {item}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder} className="flex-1 rounded border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={add} disabled={!draft.trim()}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </Field>
  );
}

const CANCELLATION_PRESETS: { label: string; value: string }[] = [
  {
    label: 'Flexible (14 days)',
    value: 'Full refund if cancelled 14 or more days before the retreat start date. 50% refund if cancelled 7–14 days before. No refund for cancellations within 7 days of the start date. All refunds exclude the non-refundable deposit.',
  },
  {
    label: 'Moderate (30 days)',
    value: 'Full refund if cancelled 30 or more days before the retreat start date. 50% refund if cancelled 15–30 days before. No refund for cancellations within 14 days of the start date. All refunds exclude the non-refundable deposit.',
  },
  {
    label: 'Strict (60 days)',
    value: 'Full refund if cancelled 60 or more days before the retreat start date. 50% refund if cancelled 30–60 days before. No refund for cancellations within 30 days of the start date. The deposit is non-refundable.',
  },
  {
    label: 'Non-Refundable',
    value: 'All payments are non-refundable after booking confirmation. The deposit is non-refundable. We strongly recommend purchasing travel insurance to protect your investment.',
  },
  {
    label: 'Credit Only',
    value: 'No cash refunds are available. If you cancel 30 or more days before the retreat start date, you will receive full credit toward a future retreat (valid for 12 months). Cancellations within 30 days receive 50% credit. No credit for cancellations within 7 days.',
  },
  {
    label: 'Tiered with Transfer Option',
    value: 'Full refund if cancelled 60 or more days before the retreat start date. 50% refund if cancelled 30–60 days before. Within 30 days of the start date, you may transfer your booking to another retreat or to another person at no additional charge. No refund within 7 days of the start date. The deposit is non-refundable.',
  },
];

function CancellationPolicyField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const handlePresetChange = (presetLabel: string) => {
    setSelectedPreset(presetLabel);
    if (presetLabel === 'custom') return;
    const preset = CANCELLATION_PRESETS.find((p) => p.label === presetLabel);
    if (preset) onChange(preset.value);
  };

  return (
    <Field label="Cancellation Policy">
      <div className="space-y-2">
        <select value={selectedPreset} onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
          <option value="">Choose a template or write your own...</option>
          {CANCELLATION_PRESETS.map((p) => (
            <option key={p.label} value={p.label}>{p.label}</option>
          ))}
          <option value="custom">Custom (write your own)</option>
        </select>
        <textarea value={value} onChange={(e) => { onChange(e.target.value); setSelectedPreset('custom'); }}
          placeholder="Your cancellation policy will appear here. Choose a template above or write your own..."
          rows={4} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
      </div>
    </Field>
  );
}
