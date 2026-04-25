'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface TeacherProfile {
  id?: string;
  person_id: string;
  short_bio: string;
  public_bio: string;
  teaching_style: string;
  years_experience: number | null;
  certifications: Array<{ name: string; issuer: string; year: number | string }>;
  specialties: string[];
  languages: string[];
  photo_url: string | null;
  banner_image_url: string | null;
  intro_video_url: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  website_slug: string | null;
  meta_description: string | null;
  is_featured: boolean;
  is_active: boolean;
}

const EMPTY_PROFILE: Omit<TeacherProfile, 'person_id'> = {
  short_bio: '',
  public_bio: '',
  teaching_style: '',
  years_experience: null,
  certifications: [],
  specialties: [],
  languages: ['English'],
  photo_url: null,
  banner_image_url: null,
  intro_video_url: null,
  website_url: null,
  social_links: {},
  website_slug: null,
  meta_description: null,
  is_featured: false,
  is_active: true,
};

interface Props {
  personId: string;
  sessionAccessLevel: number;
}

export function TeacherProfileEditor({ personId, sessionAccessLevel }: Props) {
  const [profile, setProfile] = useState<TeacherProfile>({ person_id: personId, ...EMPTY_PROFILE });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isInitialLoad = useRef(true);

  // ── Load ──
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/teacher-profiles?personId=${personId}`);
      const data = await res.json();
      if (data.profile) {
        setProfile({
          ...EMPTY_PROFILE,
          ...data.profile,
          certifications: data.profile.certifications ?? [],
          specialties: data.profile.specialties ?? [],
          languages: data.profile.languages?.length ? data.profile.languages : ['English'],
          social_links: data.profile.social_links ?? {},
        });
      }
      setLoading(false);
      isInitialLoad.current = false;
    })();
  }, [personId]);

  // ── Debounced save ──
  const save = useCallback(async (data: TeacherProfile) => {
    setSaveStatus('saving');
    await fetch('/api/admin/teacher-profiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, []);

  const update = useCallback((partial: Partial<TeacherProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...partial };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => save(next), 500);
      return next;
    });
  }, [save]);

  // ── Social link helper ──
  const setSocial = useCallback((key: string, value: string) => {
    update({ social_links: { ...profile.social_links, [key]: value } });
  }, [profile.social_links, update]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Teacher / Leader Profile</h3>
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving...
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" /> Saved
          </span>
        )}
      </div>

      {/* Section 1 — Essentials */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Essentials</CardTitle>
          <p className="text-[11px] text-muted-foreground">Required — appears on retreat cards and listings</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Short Bio">
            <textarea value={profile.short_bio} onChange={(e) => update({ short_bio: e.target.value })}
              placeholder="2-3 sentences for retreat cards..."
              rows={3} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
          </Field>
          <Field label="Photo URL">
            <input value={profile.photo_url ?? ''} onChange={(e) => update({ photo_url: e.target.value || null })}
              placeholder="https://..." className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <Field label="Teaching Style">
            <input value={profile.teaching_style} onChange={(e) => update({ teaching_style: e.target.value })}
              placeholder="e.g. Vinyasa-informed, somatic, trauma-aware" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
        </CardContent>
      </Card>

      {/* Section 2 — Experience & Credentials */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Experience & Credentials</CardTitle>
          <p className="text-[11px] text-muted-foreground">Recommended — builds credibility on your teacher page</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Full Bio">
            <textarea value={profile.public_bio} onChange={(e) => update({ public_bio: e.target.value })}
              placeholder="Full bio for your dedicated teacher page..."
              rows={6} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
          </Field>
          <Field label="Years of Experience">
            <input type="number" value={profile.years_experience ?? ''} min={0} max={99}
              onChange={(e) => update({ years_experience: e.target.value ? Number(e.target.value) : null })}
              className="w-32 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <TagListField label="Specialties" items={profile.specialties}
            onChange={(specialties) => update({ specialties })} placeholder="Add specialty..." />
          <TagListField label="Languages" items={profile.languages}
            onChange={(languages) => update({ languages })} placeholder="Add language..." />
          <CertificationsField certs={profile.certifications}
            onChange={(certifications) => update({ certifications })} />
        </CardContent>
      </Card>

      {/* Section 3 — Web & Social */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Web & Social</CardTitle>
          <p className="text-[11px] text-muted-foreground">Links — connect your audience across platforms</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Website URL">
            <input value={profile.website_url ?? ''} onChange={(e) => update({ website_url: e.target.value || null })}
              placeholder="https://yoursite.com" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <Field label="Intro Video URL">
            <input value={profile.intro_video_url ?? ''} onChange={(e) => update({ intro_video_url: e.target.value || null })}
              placeholder="https://youtube.com/watch?v=..." className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <Field label="Banner Image URL">
            <input value={profile.banner_image_url ?? ''} onChange={(e) => update({ banner_image_url: e.target.value || null })}
              placeholder="https://... (wide banner for teacher page)" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Social Links</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {(['instagram', 'facebook', 'youtube', 'spotify', 'tiktok', 'linkedin'] as const).map((platform) => (
                <div key={platform} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-muted-foreground capitalize">{platform}</span>
                  <input value={profile.social_links[platform] ?? ''} onChange={(e) => setSocial(platform, e.target.value)}
                    placeholder={platform === 'instagram' ? '@handle' : `https://${platform}.com/...`}
                    className="flex-1 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 — Website & SEO (admin only) */}
      {sessionAccessLevel >= 5 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Website & SEO</CardTitle>
            <p className="text-[11px] text-muted-foreground">Admin — website display settings</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Website Slug">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">/teachers/</span>
                <input value={profile.website_slug ?? ''} onChange={(e) => update({ website_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') || null })}
                  placeholder="jane-doe" className="flex-1 rounded border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            </Field>
            <Field label="Meta Description">
              <div className="space-y-1">
                <textarea value={profile.meta_description ?? ''} onChange={(e) => update({ meta_description: e.target.value || null })}
                  placeholder="SEO description for this teacher's page (~155 characters)"
                  rows={2} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
                <p className="text-[10px] text-muted-foreground text-right">{(profile.meta_description ?? '').length}/155</p>
              </div>
            </Field>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={profile.is_featured} onChange={(e) => update({ is_featured: e.target.checked })}
                  className="rounded border" />
                Feature on Meet Our Teachers page
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={profile.is_active} onChange={(e) => update({ is_active: e.target.checked })}
                  className="rounded border" />
                Profile visible on website
              </label>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TagListField({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (items: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft('');
  };
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5 mb-1.5 min-h-[32px] items-start">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-[8px] border bg-background px-2.5 py-1 text-sm text-foreground/90">
            {item}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder} className="flex-1 rounded border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Field>
  );
}

function CertificationsField({ certs, onChange }: {
  certs: Array<{ name: string; issuer: string; year: number | string }>;
  onChange: (certs: Array<{ name: string; issuer: string; year: number | string }>) => void;
}) {
  const updateCert = (idx: number, field: string, value: string | number) => {
    onChange(certs.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };
  return (
    <Field label="Certifications">
      <div className="space-y-2">
        {certs.map((cert, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input value={cert.name} onChange={(e) => updateCert(i, 'name', e.target.value)}
              placeholder="Certification name" className="flex-1 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            <input value={cert.issuer} onChange={(e) => updateCert(i, 'issuer', e.target.value)}
              placeholder="Issuing org" className="flex-1 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            <input type="number" value={cert.year} onChange={(e) => updateCert(i, 'year', e.target.value ? Number(e.target.value) : '')}
              placeholder="Year" className="w-20 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => onChange(certs.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => onChange([...certs, { name: '', issuer: '', year: '' as unknown as number }])} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Certification
        </Button>
      </div>
    </Field>
  );
}
