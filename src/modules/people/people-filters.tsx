'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import type { Role, RoleCategory } from '@/types';
import type { PeopleFilters as Filters } from './types';
import type { TranslationKeys } from '@/i18n/en';

const roleCategories: Array<RoleCategory | 'all'> = [
  'all',
  'ownership',
  'management',
  'staff_front',
  'staff_kitchen',
  'staff_housekeeping',
  'staff_admin',
  'wellness',
  'education',
  'activity_provider',
  'guest',
  'external',
  'vendor',
  'volunteer',
];

interface PeopleFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  roles: Role[];
  dict: TranslationKeys;
}

export function PeopleFilters({ filters, onChange, roles, dict }: PeopleFiltersProps) {
  const categoryLabels: Record<string, string> = {
    all: dict.people.allCategories,
    ownership: dict.people.cat_ownership,
    management: dict.people.cat_management,
    staff_front: dict.people.cat_staff_front,
    staff_kitchen: dict.people.cat_staff_kitchen,
    staff_housekeeping: dict.people.cat_staff_housekeeping,
    staff_admin: dict.people.cat_staff_admin,
    wellness: dict.people.cat_wellness,
    education: dict.people.cat_education,
    activity_provider: dict.people.cat_activity,
    guest: dict.people.cat_guest,
    external: dict.people.cat_external,
    vendor: dict.people.cat_vendor,
    volunteer: dict.people.cat_volunteer,
  };

  // Filter roles by selected category
  const filteredRoles =
    filters.roleCategory === 'all'
      ? roles
      : roles.filter((r) => r.category === filters.roleCategory);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={dict.people.searchPlaceholder}
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <Button
              key={s}
              variant={filters.status === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...filters, status: s })}
            >
              {s === 'all' ? dict.people.allStatuses : s === 'active' ? dict.people.statusActive : dict.people.statusInactive}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {roleCategories.map((cat) => (
          <Button
            key={cat}
            variant={filters.roleCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange({ ...filters, roleCategory: cat, roleSlug: 'all' })}
          >
            {categoryLabels[cat] ?? cat}
          </Button>
        ))}
      </div>

      {filters.roleCategory !== 'all' && filteredRoles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <Button
            variant={filters.roleSlug === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange({ ...filters, roleSlug: 'all' })}
          >
            {dict.people.allRoles}
          </Button>
          {filteredRoles.map((role) => (
            <Button
              key={role.slug}
              variant={filters.roleSlug === role.slug ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...filters, roleSlug: role.slug })}
            >
              {(dict.people[`role_${role.slug}` as keyof typeof dict.people] as string) ?? role.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
