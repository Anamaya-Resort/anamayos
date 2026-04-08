'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared';
import type { PersonDetail } from './types';
import type { TranslationKeys } from '@/i18n/en';

interface PersonDetailViewProps {
  person: PersonDetail;
  dict: TranslationKeys;
}

export function PersonDetailView({ person, dict }: PersonDetailViewProps) {
  const activeRoles = person.role_assignments.filter(
    (ra) => ra.status === 'active',
  );
  const inactiveRoles = person.role_assignments.filter(
    (ra) => ra.status !== 'active',
  );

  function accessLabel(level: number): string {
    const key = `level_${level}` as keyof typeof dict.people;
    return (dict.people[key] as string) ?? `L${level}`;
  }

  function categoryLabel(category: string): string {
    const key = `cat_${category}` as keyof typeof dict.people;
    return (dict.people[key] as string) ?? category;
  }

  function employmentLabel(type: string): string {
    const key = `emp_${type}` as keyof typeof dict.people;
    return (dict.people[key] as string) ?? type.replace('_', ' ');
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
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile info */}
        <Card>
          <CardHeader>
            <CardTitle>{dict.people.profileInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label={dict.people.name} value={person.full_name || '—'} />
            <Row label={dict.people.email} value={person.email} />
            <Row label={dict.people.phone} value={person.phone || '—'} />
            <Row
              label={dict.people.accessLevel}
              value={accessLabel(person.access_level)}
            />
            <Row label={dict.people.language} value={(person.preferred_language ?? 'en').toUpperCase()} />
            <Row label={dict.people.currency} value={person.preferred_currency ?? 'USD'} />
            <Row
              label={dict.people.status}
              value={person.is_active ? dict.people.statusActive : dict.people.statusInactive}
            />
            {person.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium">{dict.people.notes}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{person.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active roles */}
        <Card>
          <CardHeader>
            <CardTitle>
              {dict.people.activeRoles} ({activeRoles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{dict.people.noRoles}</p>
            ) : (
              <ul className="space-y-3">
                {activeRoles.map((ra) => (
                  <li key={ra.id} className="flex items-start justify-between text-sm">
                    <div>
                      <p className="font-medium">{roleLabel(ra.role.slug, ra.role.name)}</p>
                      {ra.role.description && (
                        <p className="text-muted-foreground">{ra.role.description}</p>
                      )}
                      <div className="mt-1 flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {categoryLabel(ra.role.category)}
                        </Badge>
                        {ra.employment_type && (
                          <Badge variant="outline" className="text-xs">
                            {employmentLabel(ra.employment_type)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{dict.people.since} {ra.starts_at}</p>
                      {ra.ends_at && <p>{dict.people.until} {ra.ends_at}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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
                    <Badge variant="outline" className="text-xs">
                      {ra.status}
                    </Badge>
                  </div>
                  <span className="text-xs">
                    {ra.starts_at} — {ra.ends_at ?? '?'}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
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
