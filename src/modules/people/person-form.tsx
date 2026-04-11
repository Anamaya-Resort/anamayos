'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Person } from '@/types';
import type { TranslationKeys } from '@/i18n/en';

interface PersonFormProps {
  person?: Person | null;
  dict: TranslationKeys;
  onSaved: () => void;
  onCancel: () => void;
}

export function PersonForm({ person, dict, onSaved, onCancel }: PersonFormProps) {
  const isEdit = !!person;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: person?.email ?? '',
    full_name: person?.full_name ?? '',
    phone: person?.phone ?? '',
    gender: person?.gender ?? '',
    date_of_birth: person?.date_of_birth ?? '',
    country: person?.country ?? '',
    city: person?.city ?? '',
    nationality: person?.nationality ?? '',
    pronouns: person?.pronouns ?? '',
    whatsapp_number: person?.whatsapp_number ?? '',
    instagram_handle: person?.instagram_handle ?? '',
    communication_preference: person?.communication_preference ?? 'email',
    notes: person?.notes ?? '',
    is_active: person?.is_active ?? true,
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit ? { ...form, id: person!.id } : form;

    try {
      const res = await fetch('/api/admin/persons', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || dict.common.error);
      } else {
        onSaved();
      }
    } catch {
      setError(dict.common.error);
    } finally {
      setSaving(false);
    }
  }

  const d = dict.people;
  const dp = dict.profile;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid gap-4 sm:grid-cols-2">
        {!isEdit && (
          <div className="sm:col-span-2">
            <Label>{d.email} *</Label>
            <Input value={form.email} onChange={(e) => set('email', e.target.value)} required type="email" />
          </div>
        )}
        <div>
          <Label>{d.name}</Label>
          <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
        </div>
        <div>
          <Label>{d.phone}</Label>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <Label>{dp.gender}</Label>
          <Input value={form.gender} onChange={(e) => set('gender', e.target.value)} placeholder="female, male, non-binary..." />
        </div>
        <div>
          <Label>{dp.dateOfBirth}</Label>
          <Input value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} type="date" />
        </div>
        <div>
          <Label>{dp.country}</Label>
          <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
        </div>
        <div>
          <Label>{dp.city}</Label>
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div>
          <Label>{dp.nationality}</Label>
          <Input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
        </div>
        <div>
          <Label>{dp.pronouns}</Label>
          <Input value={form.pronouns} onChange={(e) => set('pronouns', e.target.value)} placeholder="she/her, he/him, they/them..." />
        </div>
        <div>
          <Label>{dp.whatsapp}</Label>
          <Input value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} />
        </div>
        <div>
          <Label>{dp.instagram}</Label>
          <Input value={form.instagram_handle} onChange={(e) => set('instagram_handle', e.target.value)} placeholder="@handle" />
        </div>
        <div className="sm:col-span-2">
          <Label>{d.notes}</Label>
          <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="ao-btn-fx--subtle">
          {dict.common.cancel}
        </Button>
        <Button type="submit" disabled={saving} className="ao-btn-fx--success">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {dict.common.save}
        </Button>
      </div>
    </form>
  );
}
