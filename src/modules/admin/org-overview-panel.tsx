'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Users, Crown, BookOpen } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  owner?: { id: string; full_name: string; email: string };
  org_members?: Array<{ id: string; person_id: string; role: string; person?: { id: string; full_name: string; email: string; avatar_url: string | null } }>;
  brandGuides?: Array<{ id: string; name: string }>;
}

export function OrgOverviewPanel() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const loadOrgs = async () => {
    const res = await fetch('/api/admin/organizations');
    if (res.ok) {
      const data = await res.json();
      const orgList = data.organizations as Organization[];
      // Fetch brand guides for each org
      const enriched = await Promise.all(orgList.map(async (org) => {
        try {
          const bgRes = await fetch(`/api/admin/ai/brand-guide?orgId=${org.id}`);
          if (bgRes.ok) {
            const bgData = await bgRes.json();
            const guideList = (bgData.guides ?? (bgData.guide ? [bgData.guide] : [])) as Array<Record<string, unknown>>;
            return { ...org, brandGuides: guideList.filter(Boolean).map((g) => ({ id: g.id as string, name: (g.name as string) || 'Untitled' })) };
          }
        } catch { /* ignore */ }
        return { ...org, brandGuides: [] };
      }));
      setOrgs(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { loadOrgs(); }, []);

  const createOrg = async () => {
    setCreating(true);
    const res = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, slug: newSlug }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      await loadOrgs();
    }
    setCreating(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Organizations</h3>
          <p className="text-sm text-muted-foreground">Manage your organizations and their members.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-4 w-4" /> New Organization
        </Button>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No organizations yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <Card key={org.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{org.name}</h4>
                    <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                    {org.description && <p className="text-sm text-muted-foreground mt-1">{org.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Crown className="h-3.5 w-3.5" />
                    {org.owner?.full_name ?? 'Unknown'}
                  </div>
                </div>
                {org.org_members && org.org_members.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <Users className="h-3.5 w-3.5" /> Members ({org.org_members.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {org.org_members.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1">
                          <span>{m.person?.full_name ?? m.person?.email ?? 'Unknown'}</span>
                          <span className="text-muted-foreground">({m.role})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Brand Guides */}
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <BookOpen className="h-3.5 w-3.5" /> Brand Guides ({org.brandGuides?.length ?? 0})
                  </div>
                  {org.brandGuides && org.brandGuides.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {org.brandGuides.map((bg) => (
                        <button key={bg.id} onClick={() => { window.location.hash = 'ai-data'; }}
                          className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2.5 py-1 hover:bg-muted transition-colors cursor-pointer">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                          <span>{bg.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No brand guides yet. <button onClick={() => { window.location.hash = 'ai-data'; }} className="underline hover:text-foreground">Create one</button> in the AI Data tab.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create org dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input type="text" value={newName}
                onChange={(e) => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }}
                placeholder="My Resort" className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <input type="text" value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="my-resort" className="w-full border rounded px-3 py-2 text-sm font-mono mt-1" />
              <p className="text-xs text-muted-foreground mt-1">URL-safe identifier (lowercase, hyphens only)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createOrg} disabled={creating || !newName || !newSlug}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
