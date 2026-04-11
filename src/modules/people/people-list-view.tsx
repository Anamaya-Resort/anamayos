'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, EmptyState } from '@/components/shared';
import { PeopleFilters } from './people-filters';
import { PeopleTable } from './people-table';
import { PersonForm } from './person-form';
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
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({
    search: '',
    roleCategory: 'all',
    roleSlug: 'all',
    status: 'all',
  });
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = initialPeople.filter((p) => {
    if (filters.status === 'active' && !p.is_active) return false;
    if (filters.status === 'inactive' && p.is_active) return false;
    if (filters.roleCategory !== 'all') {
      const hasCategory = p.roles.some((r) => r.category === filters.roleCategory);
      if (!hasCategory) return false;
    }
    if (filters.roleSlug !== 'all') {
      const hasRole = p.roles.some((r) => r.slug === filters.roleSlug);
      if (!hasRole) return false;
    }
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
          <Button onClick={() => setCreateOpen(true)} className="ao-btn-fx--strong">
            <UserPlus className="mr-2 h-4 w-4" />
            {dict.people.addPerson}
          </Button>
        }
      />

      <PeopleFilters filters={filters} onChange={setFilters} roles={roles} dict={dict} />

      {filtered.length === 0 ? (
        <EmptyState title={dict.people.noPeople} description={dict.people.noPeopleDesc} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <PeopleTable people={filtered} dict={dict} />
          </CardContent>
        </Card>
      )}

      {/* Create Person Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.people.addPerson}</DialogTitle>
          </DialogHeader>
          <PersonForm
            dict={dict}
            onSaved={() => { setCreateOpen(false); router.refresh(); }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
