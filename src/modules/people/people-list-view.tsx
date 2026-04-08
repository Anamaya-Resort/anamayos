'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, EmptyState } from '@/components/shared';
import { PeopleFilters } from './people-filters';
import { PeopleTable } from './people-table';
import type { PersonListItem, PeopleFilters as Filters } from './types';
import type { Role } from '@/types';
import type { TranslationKeys } from '@/i18n/en';
import { UserPlus } from 'lucide-react';

interface PeopleListViewProps {
  initialPeople: PersonListItem[];
  roles: Role[];
  dict: TranslationKeys;
}

export function PeopleListView({ initialPeople, roles, dict }: PeopleListViewProps) {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    roleCategory: 'all',
    roleSlug: 'all',
    status: 'all',
  });

  const filtered = initialPeople.filter((p) => {
    // Status filter
    if (filters.status === 'active' && !p.is_active) return false;
    if (filters.status === 'inactive' && p.is_active) return false;

    // Role category filter
    if (filters.roleCategory !== 'all') {
      const hasCategory = p.roles.some((r) => r.category === filters.roleCategory);
      if (!hasCategory) return false;
    }

    // Specific role filter
    if (filters.roleSlug !== 'all') {
      const hasRole = p.roles.some((r) => r.slug === filters.roleSlug);
      if (!hasRole) return false;
    }

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        (p.full_name?.toLowerCase().includes(q) ?? false) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone?.toLowerCase().includes(q) ?? false) ||
        p.roles.some((r) => r.name.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.people.title}
        description={`${initialPeople.length} ${dict.people.totalPeople}`}
        actions={
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            {dict.people.addPerson}
          </Button>
        }
      />

      <PeopleFilters
        filters={filters}
        onChange={setFilters}
        roles={roles}
        dict={dict}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={dict.people.noPeople}
          description={dict.people.noPeopleDesc}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <PeopleTable people={filtered} dict={dict} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
