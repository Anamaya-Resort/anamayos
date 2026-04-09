'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Loader2 } from 'lucide-react';
import type { Role, PersonRole } from '@/types';
import type { TranslationKeys } from '@/i18n/en';

interface RoleAssignmentProps {
  personId: string;
  currentRoles: Array<PersonRole & { role: Role }>;
  allRoles: Role[];
  dict: TranslationKeys;
  onChanged: () => void;
}

export function RoleAssignment({ personId, currentRoles, allRoles, dict, onChanged }: RoleAssignmentProps) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const activeRoles = currentRoles.filter((r) => r.status === 'active');
  const activeRoleIds = new Set(activeRoles.map((r) => r.role_id));
  const availableRoles = allRoles.filter((r) => !activeRoleIds.has(r.id) && r.is_active);

  function roleLabel(slug: string, fallback: string): string {
    const key = `role_${slug}` as keyof typeof dict.people;
    return (dict.people[key] as string) ?? fallback;
  }

  async function addRole() {
    if (!selectedRoleId) return;
    setAdding(true);
    try {
      await fetch('/api/admin/persons/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId, role_id: selectedRoleId }),
      });
      setSelectedRoleId('');
      onChanged();
    } finally {
      setAdding(false);
    }
  }

  async function removeRole(personRoleId: string) {
    setRemoving(personRoleId);
    try {
      await fetch('/api/admin/persons/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_role_id: personRoleId }),
      });
      onChanged();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dict.people.activeRoles} ({activeRoles.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current roles */}
        {activeRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.people.noRoles}</p>
        ) : (
          <ul className="space-y-2">
            {activeRoles.map((ra) => (
              <li key={ra.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{roleLabel(ra.role.slug, ra.role.name)}</Badge>
                  <span className="text-xs text-muted-foreground">{dict.people.since} {ra.starts_at}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRole(ra.id)}
                  disabled={removing === ra.id}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  {removing === ra.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Add role */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="flex-1 h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{dict.people.allRoles}...</option>
            {availableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {roleLabel(role.slug, role.name)}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addRole} disabled={!selectedRoleId || adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
