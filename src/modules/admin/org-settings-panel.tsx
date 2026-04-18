'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { OrgOverviewPanel } from './org-overview-panel';
import { BrandingPanel } from './branding-panel';
import { OrgLogosPanel } from './org-logos-panel';
import { OrgGraphicsPanel } from './org-graphics-panel';

interface Org {
  id: string;
  name: string;
}

/**
 * Organization settings with sub-tabs: Overview, Branding, Logos, App Graphics.
 * Fetches the user's first org on mount for logo/graphics panels.
 */
export function OrgSettingsPanel() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/organizations');
        if (res.ok) {
          const data = await res.json();
          const orgList = data.organizations ?? [];
          setOrgs(orgList);
          if (orgList.length > 0) setSelectedOrgId(orgList[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Org selector (for superadmins with multiple orgs) */}
      {orgs.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Organization:</label>
          <select value={selectedOrgId ?? ''} onChange={(e) => setSelectedOrgId(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="logos" disabled={!selectedOrgId}>Logos</TabsTrigger>
          <TabsTrigger value="graphics" disabled={!selectedOrgId}>App Graphics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OrgOverviewPanel />
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <BrandingPanel />
        </TabsContent>

        <TabsContent value="logos" className="mt-4">
          {selectedOrgId && <OrgLogosPanel orgId={selectedOrgId} />}
        </TabsContent>

        <TabsContent value="graphics" className="mt-4">
          {selectedOrgId && <OrgGraphicsPanel orgId={selectedOrgId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
