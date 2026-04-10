'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Booking } from '@/types';
import type { TranslationKeys } from '@/i18n/en';

interface BookingFormProps {
  booking?: Booking | null;
  rooms: Array<{ id: string; name: string }>;
  dict: TranslationKeys;
  onSaved: () => void;
  onCancel: () => void;
}

const STATUSES = [
  'inquiry', 'quote_sent', 'confirmed', 'deposit_paid',
  'paid_in_full', 'checked_in', 'checked_out', 'cancelled', 'no_show',
];

export function BookingForm({ booking, rooms, dict, onSaved, onCancel }: BookingFormProps) {
  const isEdit = !!booking;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    person_id: booking?.person_id ?? '',
    check_in: booking?.check_in ?? '',
    check_out: booking?.check_out ?? '',
    room_id: booking?.room_id ?? '',
    status: booking?.status ?? 'inquiry',
    num_guests: booking?.num_guests ?? 1,
    total_amount: booking?.total_amount ?? 0,
    currency: booking?.currency ?? 'USD',
    notes: booking?.notes ?? '',
  });

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit ? { ...form, id: booking!.id } : form;

    try {
      const res = await fetch('/api/admin/bookings', {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid gap-4 sm:grid-cols-2">
        {!isEdit && (
          <div className="sm:col-span-2">
            <Label>{dict.bookings.guest} ID *</Label>
            <Input
              value={form.person_id}
              onChange={(e) => set('person_id', e.target.value)}
              required
              placeholder="Person UUID"
            />
          </div>
        )}
        <div>
          <Label>{dict.bookings.checkIn} *</Label>
          <Input value={form.check_in} onChange={(e) => set('check_in', e.target.value)} type="date" required />
        </div>
        <div>
          <Label>{dict.bookings.checkOut} *</Label>
          <Input value={form.check_out} onChange={(e) => set('check_out', e.target.value)} type="date" required />
        </div>
        <div>
          <Label>{dict.bookings.status}</Label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {dict.bookings[`status_${s}` as keyof typeof dict.bookings] as string ?? s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>{dict.calendar.room}</Label>
          <select
            value={form.room_id}
            onChange={(e) => set('room_id', e.target.value)}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>{dict.bookings.guests}</Label>
          <Input
            type="number"
            min={1}
            value={form.num_guests}
            onChange={(e) => set('num_guests', parseInt(e.target.value) || 1)}
          />
        </div>
        <div>
          <Label>{dict.bookings.total}</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={form.total_amount}
            onChange={(e) => set('total_amount', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{dict.bookings.notes}</Label>
          <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{dict.common.cancel}</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {dict.common.save}
        </Button>
      </div>
    </form>
  );
}
