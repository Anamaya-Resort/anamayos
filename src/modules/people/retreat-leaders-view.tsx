'use client';

import { useState } from 'react';
import Link from 'next/link';
import { decodeHtml } from '@/lib/decode-html';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import { formatDateShort } from '@/lib/format-date';
import type { TranslationKeys } from '@/i18n/en';
import type { Locale } from '@/config/app';
import { Search, CheckCircle2, AlertCircle, Star } from 'lucide-react';

interface RetreatLeaderRow {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  retreat_leader_profile: {
    short_bio: string;
    photo_url: string | null;
    is_featured: boolean;
    is_active: boolean;
  } | null;
  retreats: Array<{
    retreat_id: string;
    role: string;
    is_primary: boolean;
    retreat: {
      id: string;
      name: string;
      start_date: string | null;
      end_date: string | null;
      status: string;
    };
  }>;
}

interface Props {
  leaders: RetreatLeaderRow[];
  dict: TranslationKeys;
  locale?: Locale;
}

export function RetreatLeadersView({ leaders, dict, locale = 'en' }: Props) {
  const [search, setSearch] = useState('');

  const filtered = leaders.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.full_name?.toLowerCase().includes(q) ?? false) ||
      l.email.toLowerCase().includes(q) ||
      l.retreats.some((r) => r.retreat.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retreat Leaders"
        description={`${leaders.length} retreat leader${leaders.length !== 1 ? 's' : ''}`}
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or retreat..."
          className="w-full rounded border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No retreat leaders match your search' : 'No retreat leaders yet'}
          description={search ? 'Try a different search term.' : 'Assign a retreat leader role to a person to see them here.'}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Profile</th>
                    <th className="pb-3 pr-4 font-medium">Retreats</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((leader) => {
                    const hasProfile = !!leader.retreat_leader_profile;
                    const profileComplete = hasProfile && !!leader.retreat_leader_profile!.short_bio;
                    const upcomingRetreats = leader.retreats.filter(
                      (r) => r.retreat.status === 'confirmed' || r.retreat.status === 'draft'
                    );
                    const pastRetreats = leader.retreats.filter(
                      (r) => r.retreat.status === 'completed'
                    );

                    return (
                      <tr key={leader.id} className="border-b last:border-0 hover:bg-muted/50">
                        {/* Name */}
                        <td className="py-3 pr-4">
                          <Link href={`/dashboard/people/${leader.id}`}
                            className="font-medium text-primary hover:underline">
                            {leader.full_name || leader.email}
                          </Link>
                          {leader.retreat_leader_profile?.is_featured && (
                            <Star className="inline ml-1.5 h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </td>

                        {/* Email */}
                        <td className="py-3 pr-4 text-muted-foreground">{leader.email}</td>

                        {/* Profile Status */}
                        <td className="py-3 pr-4">
                          {profileComplete ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                            </span>
                          ) : hasProfile ? (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertCircle className="h-3.5 w-3.5" /> Incomplete
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <AlertCircle className="h-3.5 w-3.5" /> Not started
                            </span>
                          )}
                        </td>

                        {/* Retreats */}
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {upcomingRetreats.length === 0 && pastRetreats.length === 0 && (
                              <span className="text-muted-foreground text-xs">No retreats</span>
                            )}
                            {upcomingRetreats.slice(0, 3).map((r) => (
                              <Link key={r.retreat_id} href={`/dashboard/retreats/${r.retreat_id}`}>
                                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                                  {decodeHtml(r.retreat.name)}
                                  {r.retreat.start_date && (
                                    <span className="ml-1 text-muted-foreground">
                                      {formatDateShort(r.retreat.start_date, locale)}
                                    </span>
                                  )}
                                </Badge>
                              </Link>
                            ))}
                            {upcomingRetreats.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{upcomingRetreats.length - 3}</Badge>
                            )}
                            {pastRetreats.length > 0 && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                +{pastRetreats.length} past
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3">
                          <span className={leader.is_active ? 'text-status-success' : 'text-status-destructive'}>
                            {leader.is_active ? dict.people.statusActive : dict.people.statusInactive}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
