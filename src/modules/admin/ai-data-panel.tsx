'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { AiBrandGuidePanel } from './ai-brand-guide-panel';
import { AiArchetypesPanel } from './ai-archetypes-panel';
import { AiContentPromptsPanel } from './ai-content-prompts-panel';
import type { AiProvider } from './ai-provider-card';

interface Props {
  orgId: string;
}

export function AiDataPanel({ orgId }: Props) {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string | null>('brand-guide');

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/providers');
      const data = await res.json();
      setProviders(data.providers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const sections = [
    { id: 'brand-guide', label: 'Brand Guide', description: 'Define your brand voice, messaging, and AI writing context' },
    { id: 'archetypes', label: 'Customer Archetypes', description: 'Target audience profiles for personalized content' },
    { id: 'content-prompts', label: 'Content Prompts', description: 'Reusable AI prompt templates for articles, ads, video, and more' },
  ];

  return (
    <div className="space-y-3">
      <div className="mb-1">
        <p className="text-xs text-muted-foreground">
          Build AI-ready data sets for content generation. These are shared with the website for automated content creation.
        </p>
      </div>

      {sections.map((section) => {
        const isOpen = openSection === section.id;
        return (
          <div key={section.id} className="border rounded-lg bg-card">
            <button
              onClick={() => setOpenSection(isOpen ? null : section.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <span className="font-semibold text-sm">{section.label}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{section.description}</p>
                </div>
              </div>
            </button>
            {isOpen && (
              <div className="border-t px-4 pb-4 pt-3">
                {section.id === 'brand-guide' && <AiBrandGuidePanel orgId={orgId} providers={providers} />}
                {section.id === 'archetypes' && <AiArchetypesPanel orgId={orgId} providers={providers} />}
                {section.id === 'content-prompts' && <AiContentPromptsPanel orgId={orgId} providers={providers} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
