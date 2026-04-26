'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared';
import { PersonForm } from './person-form';
import { RoleAssignment } from './role-assignment';
import { RetreatLeaderProfileEditor } from './retreat-leader-profile-editor';
import { PersonRetreatsPanel } from './person-retreats-panel';
import type { PersonDetail } from './types';
import type { Role } from '@/types';
import type { RetreatCardData } from '@/components/shared/retreat-card';
import type { TranslationKeys } from '@/i18n/en';
import { Pencil, ChevronDown } from 'lucide-react';

const TEACHER_ROLE_SLUGS = new Set([
  'retreat_leader', 'retreat_co_teacher', 'retreat_assistant',
  'retreat_guest_speaker', 'yoga_teacher', 'facilitator',
]);

interface PersonDetailViewProps {
  person: PersonDetail;
  allRoles: Role[];
  dict: TranslationKeys;
  sessionAccessLevel: number;
  retreats?: RetreatCardData[];
}

export function PersonDetailView({ person, allRoles, dict, sessionAccessLevel, retreats }: PersonDetailViewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);

  const activeRoles = person.role_assignments.filter((ra) => ra.status === 'active');
  const inactiveRoles = person.role_assignments.filter((ra) => ra.status !== 'active');
  const isLeader = activeRoles.some((ra) => TEACHER_ROLE_SLUGS.has(ra.role.slug));

  function accessLabel(level: number): string {
    const key = `level_${level}` as keyof typeof dict.people;
    return (dict.people[key] as string) ?? `L${level}`;
  }

  function roleLabel(slug: string, fallback: string): string {
    const key = `role_${slug}` as keyof typeof dict.people;
    return (dict.people[key] as string) ?? fallback;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={person.full_name || person.email}
        description={person.email}
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {dict.common.edit}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Profile info with inline roles */}
        <Card>
          <CardHeader>
            <CardTitle>{dict.people.profileInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label={dict.people.name} value={person.full_name || '—'} />
            <Row label={dict.people.email} value={person.email} />
            <Row label={dict.people.phone} value={person.phone || '—'} />

            {/* Active roles — inline badges */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{dict.people.roles}</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {activeRoles.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  activeRoles.map((ra) => (
                    <Badge key={ra.id} variant="outline" className="text-xs">
                      {roleLabel(ra.role.slug, ra.role.name)}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <Row label={dict.people.accessLevel} value={accessLabel(person.access_level)} />
            <Row label={dict.people.language} value={(person.preferred_language ?? 'en').toUpperCase()} />
            <Row label={dict.people.currency} value={person.preferred_currency ?? 'USD'} />
            <Row
              label={dict.people.status}
              value={person.is_active ? dict.people.statusActive : dict.people.statusInactive}
            />
            {person.gender && <Row label={dict.profile.gender} value={person.gender} />}
            {person.date_of_birth && <Row label={dict.profile.dateOfBirth} value={person.date_of_birth} />}
            {person.country && <Row label={dict.profile.country} value={person.country} />}
            {person.nationality && <Row label={dict.profile.nationality} value={person.nationality} />}
            {person.whatsapp_number && <Row label={dict.profile.whatsapp} value={person.whatsapp_number} />}
            {person.instagram_handle && <Row label={dict.profile.instagram} value={person.instagram_handle} />}
            {person.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium">{dict.people.notes}</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{person.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Retreats panel (if leader) or placeholder */}
        {isLeader && retreats ? (
          <PersonRetreatsPanel retreats={retreats} personId={person.id} />
        ) : (
          <div /> /* empty grid cell */
        )}
      </div>

      {/* Role Management — collapsible, for admins */}
      {sessionAccessLevel >= 5 && (
        <div>
          <button onClick={() => setShowRoleManager(!showRoleManager)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            Manage Roles
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRoleManager ? 'rotate-180' : ''}`} />
          </button>
          {showRoleManager && (
            <div className="mt-2">
              <RoleAssignment
                personId={person.id}
                currentRoles={person.role_assignments}
                allRoles={allRoles}
                dict={dict}
                onChanged={() => router.refresh()}
              />
            </div>
          )}
        </div>
      )}

      {/* Retreat Leader Profile */}
      {isLeader && (
        <RetreatLeaderProfileEditor personId={person.id} sessionAccessLevel={sessionAccessLevel} />
      )}

      {/* Past/inactive roles */}
      {inactiveRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{dict.people.pastRoles} ({inactiveRoles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {inactiveRoles.map((ra) => (
                <li key={ra.id} className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{roleLabel(ra.role.slug, ra.role.name)}</span>
                    <Badge variant="outline" className="text-xs">{ra.status}</Badge>
                  </div>
                  <span className="text-xs">{ra.starts_at} — {ra.ends_at ?? '?'}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.common.edit} — {person.full_name || person.email}</DialogTitle>
          </DialogHeader>
          <PersonForm
            person={person}
            dict={dict}
            onSaved={() => { setEditOpen(false); router.refresh(); }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
