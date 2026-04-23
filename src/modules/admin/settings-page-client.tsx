'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Map hash → top-level tab
const HASH_TO_TAB: Record<string, string> = {
  general: 'general',
  organization: 'organization',
  overview: 'organization',
  branding: 'organization',
  logos: 'organization',
  graphics: 'organization',
  layouts: 'roomLayouts',
  import: 'import',
  effects: 'effects',
  ai: 'aiLlms',
};

interface SettingsPageClientProps {
  labels: { general: string; organization: string; roomLayouts: string; import: string; effects: string; aiLlms: string };
  defaultTab?: string;
  children: {
    general: React.ReactNode;
    organization: React.ReactNode;
    roomLayouts: React.ReactNode;
    import: React.ReactNode;
    effects: React.ReactNode;
    aiLlms: React.ReactNode;
  };
}

export function SettingsPageClient({ labels, defaultTab, children }: SettingsPageClientProps) {
  const [tab, setTab] = useState(defaultTab ?? 'general');

  useEffect(() => {
    function readHash() {
      const hash = window.location.hash.replace('#', '');
      if (hash && HASH_TO_TAB[hash]) setTab(HASH_TO_TAB[hash]);
    }
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  const handleTabChange = (value: string) => {
    setTab(value);
    // Set hash to a clean fragment
    const hashMap: Record<string, string> = {
      general: 'general', organization: 'organization',
      roomLayouts: 'layouts', import: 'import', effects: 'effects', aiLlms: 'ai',
    };
    window.location.hash = hashMap[value] ?? value;
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="general">{labels.general}</TabsTrigger>
        <TabsTrigger value="organization">{labels.organization}</TabsTrigger>
        <TabsTrigger value="roomLayouts">{labels.roomLayouts}</TabsTrigger>
        <TabsTrigger value="import">{labels.import}</TabsTrigger>
        <TabsTrigger value="effects">{labels.effects}</TabsTrigger>
        <TabsTrigger value="aiLlms">{labels.aiLlms}</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4">{children.general}</TabsContent>
      <TabsContent value="organization" className="mt-4">{children.organization}</TabsContent>
      <TabsContent value="roomLayouts" className="mt-4">{children.roomLayouts}</TabsContent>
      <TabsContent value="import" className="mt-4">{children.import}</TabsContent>
      <TabsContent value="effects" className="mt-4">{children.effects}</TabsContent>
      <TabsContent value="aiLlms" className="mt-4">{children.aiLlms}</TabsContent>
    </Tabs>
  );
}
