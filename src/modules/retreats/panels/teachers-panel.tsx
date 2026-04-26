'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Crown } from 'lucide-react';

interface Teacher {
  id: string;
  person_id: string;
  role: string;
  is_primary: boolean;
  bio_override: string | null;
  person: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
}

interface Props { retreatId: string; sessionPersonId: string; }

export function TeachersPanel({ retreatId, sessionPersonId }: Props) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; full_name: string | null; email: string }>>([]);
  const [searching, setSearching] = useState(false);

  const loadTeachers = useCallback(async () => {
    const res = await fetch(`/api/admin/retreat-teachers?retreatId=${retreatId}`);
    const data = await res.json();
    setTeachers(data.teachers ?? []);
    setLoading(false);
  }, [retreatId]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const searchPeople = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    // Use the persons list, filtering client-side for simplicity
    const res = await fetch('/api/admin/persons/search?q=' + encodeURIComponent(q));
    if (res.ok) {
      const data = await res.json();
      setSearchResults((data.results ?? []).filter(
        (p: { id: string }) => !teachers.some((t) => t.person_id === p.id)
      ));
    }
    setSearching(false);
  }, [teachers]);

  const addTeacher = async (personId: string) => {
    await fetch('/api/admin/retreat-teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retreat_id: retreatId, person_id: personId, role: 'co_teacher' }),
    });
    setAdding(false);
    setSearchQuery('');
    setSearchResults([]);
    await loadTeachers();
  };

  const updateTeacher = async (id: string, field: string, value: string) => {
    await fetch('/api/admin/retreat-teachers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    });
    await loadTeachers();
  };

  const removeTeacher = async (id: string) => {
    await fetch(`/api/admin/retreat-teachers?id=${id}`, { method: 'DELETE' });
    await loadTeachers();
  };

  if (loading) return <Card><CardContent className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] text-foreground/70">Teachers & Co-Leaders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current teachers */}
        <div className="space-y-2">
          {teachers.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded border bg-muted/20 px-3 py-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.person?.full_name ?? t.person?.email ?? 'Unknown'}</span>
                  {t.is_primary && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                </div>
                <span className="text-xs text-muted-foreground">{t.person?.email}</span>
              </div>
              <select value={t.role} onChange={(e) => updateTeacher(t.id, 'role', e.target.value)}
                disabled={t.is_primary}
                className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50">
                <option value="lead">Lead</option>
                <option value="co_teacher">Co-Teacher</option>
                <option value="assistant">Assistant</option>
                <option value="guest_speaker">Guest Speaker</option>
                <option value="facilitator">Facilitator</option>
              </select>
              {!t.is_primary && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeTeacher(t.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Add co-teacher */}
        {adding ? (
          <div className="space-y-2">
            <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); searchPeople(e.target.value); }}
              placeholder="Search by name or email..." autoFocus
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            {searching && <p className="text-xs text-muted-foreground">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="rounded border bg-background max-h-40 overflow-y-auto">
                {searchResults.map((p) => (
                  <button key={p.id} onClick={() => addTeacher(p.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left">
                    <span className="font-medium">{p.full_name || p.email}</span>
                    {p.full_name && <span className="text-xs text-muted-foreground">{p.email}</span>}
                  </button>
                ))}
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setSearchQuery(''); setSearchResults([]); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add Co-Teacher
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
