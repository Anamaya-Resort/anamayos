'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Person } from '@/types';
import type { TranslationKeys } from '@/i18n/en';

interface ProfileEditFormProps {
  person: Person;
  dict: TranslationKeys;
  onSaved: () => void;
  onCancel: () => void;
}

export function ProfileEditForm({ person, dict, onSaved, onCancel }: ProfileEditFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: person.full_name ?? '',
    phone: person.phone ?? '',
    gender: person.gender ?? '',
    date_of_birth: person.date_of_birth ?? '',
    country: person.country ?? '',
    city: person.city ?? '',
    nationality: person.nationality ?? '',
    pronouns: person.pronouns ?? '',
    address_line: person.address_line ?? '',
    whatsapp_number: person.whatsapp_number ?? '',
    instagram_handle: person.instagram_handle ?? '',
    communication_preference: person.communication_preference ?? 'email',
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  const dp = dict.profile;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>{dict.people.name}</Label>
          <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
        </div>
        <div>
          <Label>{dict.people.phone}</Label>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <Label>{dp.whatsapp}</Label>
          <Input value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} />
        </div>
        <div>
          <Label>{dp.gender}</Label>
          <Input value={form.gender} onChange={(e) => set('gender', e.target.value)} />
        </div>
        <div>
          <Label>{dp.pronouns}</Label>
          <Input value={form.pronouns} onChange={(e) => set('pronouns', e.target.value)} />
        </div>
        <div>
          <Label>{dp.dateOfBirth}</Label>
          <Input value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} type="date" />
        </div>
        <div>
          <Label>{dp.nationality}</Label>
          <Input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
        </div>
        <div>
          <Label>{dp.country}</Label>
          <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
        </div>
        <div>
          <Label>{dp.city}</Label>
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>{dp.address}</Label>
          <Input value={form.address_line} onChange={(e) => set('address_line', e.target.value)} />
        </div>
        <div>
          <Label>{dp.instagram}</Label>
          <Input value={form.instagram_handle} onChange={(e) => set('instagram_handle', e.target.value)} placeholder="@handle" />
        </div>
        <div>
          <Label>{dp.communicationPref}</Label>
          <select
            value={form.communication_preference}
            onChange={(e) => set('communication_preference', e.target.value)}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="sms">SMS</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="ao-btn-fx--subtle">{dict.common.cancel}</Button>
        <Button type="submit" disabled={saving} className="ao-btn-fx--success">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {dict.common.save}
        </Button>
      </div>
    </form>
  );
}
