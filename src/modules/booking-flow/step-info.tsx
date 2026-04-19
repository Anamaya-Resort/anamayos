'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { WizardState } from './booking-wizard';

interface StepInfoProps {
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepInfo({ state, onUpdate, onNext, onBack }: StepInfoProps) {
  const updateGuest = (field: keyof WizardState['guestInfo'], value: string) => {
    onUpdate({ guestInfo: { ...state.guestInfo, [field]: value } });
  };

  const updateParticipant = (idx: number, field: 'fullName' | 'email', value: string) => {
    const parts = [...state.participants];
    parts[idx] = { ...parts[idx], [field]: value };
    onUpdate({ participants: parts });
  };

  // Ensure participant slots for couple (useEffect to avoid render-time state update)
  useEffect(() => {
    if (state.numGuests >= 2 && state.participants.length === 0) {
      onUpdate({ participants: [{ fullName: '', email: '' }] });
    }
  }, [state.numGuests, state.participants.length, onUpdate]);

  const valid = state.guestInfo.fullName && state.guestInfo.email;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Your Details</h2>
        <p className="text-sm text-muted-foreground">We need some basic information to complete your booking.</p>
      </div>

      {/* Primary guest */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Primary Guest</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Full Name *</label>
            <input type="text" value={state.guestInfo.fullName}
              onChange={(e) => updateGuest('fullName', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="Jane Smith" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email *</label>
            <input type="email" value={state.guestInfo.email}
              onChange={(e) => updateGuest('email', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="jane@example.com" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Phone</label>
            <input type="tel" value={state.guestInfo.phone}
              onChange={(e) => updateGuest('phone', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="+1 555-0123" />
          </div>
        </div>
      </div>

      {/* Additional participants */}
      {state.numGuests >= 2 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Second Guest (+1)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Full Name</label>
              <input type="text" value={state.participants[0]?.fullName ?? ''}
                onChange={(e) => updateParticipant(0, 'fullName', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input type="email" value={state.participants[0]?.email ?? ''}
                onChange={(e) => updateParticipant(0, 'email', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="john@example.com" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!valid}>Next: Review</Button>
      </div>
    </div>
  );
}
