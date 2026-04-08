'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { PersonListItem } from './types';
import type { TranslationKeys } from '@/i18n/en';

interface PeopleTableProps {
  people: PersonListItem[];
  dict: TranslationKeys;
}

export function PeopleTable({ people, dict }: PeopleTableProps) {
  function accessLabel(level: number): string {
    const key = `level_${level}` as keyof typeof dict.people;
    return (dict.people[key] as string) ?? `L${level}`;
  }

  function roleLabel(slug: string, fallback: string): string {
    const key = `role_${slug}` as keyof typeof dict.people;
    return (dict.people[key] as string) ?? fallback;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-3 pr-4 font-medium">{dict.people.name}</th>
            <th className="pb-3 pr-4 font-medium">{dict.people.email}</th>
            <th className="pb-3 pr-4 font-medium">{dict.people.roles}</th>
            <th className="pb-3 pr-4 font-medium">{dict.people.accessLevel}</th>
            <th className="pb-3 font-medium">{dict.people.status}</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-3 pr-4">
                <Link
                  href={`/dashboard/people/${person.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {person.full_name || person.email}
                </Link>
              </td>
              <td className="py-3 pr-4 text-muted-foreground">
                {person.email}
              </td>
              <td className="py-3 pr-4">
                <div className="flex flex-wrap gap-1">
                  {person.roles.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    person.roles.slice(0, 3).map((r) => (
                      <Badge key={r.slug} variant="outline" className="text-xs">
                        {roleLabel(r.slug, r.name)}
                      </Badge>
                    ))
                  )}
                  {person.roles.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{person.roles.length - 3}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="py-3 pr-4">
                <Badge variant="outline" className="text-xs">
                  {accessLabel(person.access_level)}
                </Badge>
              </td>
              <td className="py-3">
                <span
                  className={
                    person.is_active
                      ? 'text-status-success'
                      : 'text-status-destructive'
                  }
                >
                  {person.is_active ? dict.people.statusActive : dict.people.statusInactive}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
