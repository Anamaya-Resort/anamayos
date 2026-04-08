import type { Person, Role, PersonRole, RoleCategory } from '@/types';

/** Person with their active roles joined */
export interface PersonListItem extends Person {
  roles: Array<{ slug: string; name: string; category: RoleCategory }>;
}

/** Full person detail with all role assignments and details */
export interface PersonDetail extends Person {
  role_assignments: Array<
    PersonRole & {
      role: Role;
    }
  >;
}

/** Filters for the people list */
export interface PeopleFilters {
  search: string;
  roleCategory: RoleCategory | 'all';
  roleSlug: string | 'all';
  status: 'active' | 'inactive' | 'all';
}
