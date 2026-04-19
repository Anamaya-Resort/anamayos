'use client';

import { useState } from 'react';
import { StepRetreat } from './step-retreat';
import { StepGuests } from './step-guests';
import { StepRooms } from './step-rooms';
import { StepBed } from './step-bed';
import { StepInfo } from './step-info';
import { StepConfirm } from './step-confirm';
import type { GuestType } from '@/lib/booking-availability';

export interface WizardState {
  // Step 1: Retreat
  retreatId?: string;
  retreatName?: string;
  checkIn: string;
  checkOut: string;
  // Step 2: Guest type
  numGuests: number;
  guestType: GuestType;
  // Step 3: Room
  roomId?: string;
  roomName?: string;
  // Step 4: Bed
  bedIds: string[];
  bedArrangement?: string;
  bookingType?: string;
  needsApproval?: boolean;
  // Step 5: Guest info
  guestInfo: {
    fullName: string;
    email: string;
    phone: string;
  };
  participants: Array<{ fullName: string; email: string }>;
}

const STEPS = ['Retreat', 'Guests', 'Room', 'Bed', 'Info', 'Confirm'] as const;

interface BookingWizardProps {
  retreats: Array<{
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    teacher: string | null;
    availableSpaces: number | null;
    currency: string;
    depositPercentage: number;
    images: unknown[];
  }>;
}

export function BookingWizard({ retreats }: BookingWizardProps) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    checkIn: '',
    checkOut: '',
    numGuests: 1,
    guestType: 'solo',
    bedIds: [],
    guestInfo: { fullName: '', email: '', phone: '' },
    participants: [],
  });

  const update = (partial: Partial<WizardState>) => setState((prev) => ({ ...prev, ...partial }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${
              i < step ? 'bg-primary' : i === step ? 'bg-primary/60' : 'bg-muted'
            }`} />
            <p className={`text-[10px] mt-1 text-center ${
              i <= step ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <StepRetreat
          retreats={retreats}
          state={state}
          onUpdate={update}
          onNext={next}
        />
      )}
      {step === 1 && (
        <StepGuests
          state={state}
          onUpdate={update}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <StepRooms
          state={state}
          onUpdate={update}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <StepBed
          state={state}
          onUpdate={update}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <StepInfo
          state={state}
          onUpdate={update}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 5 && (
        <StepConfirm
          state={state}
          onBack={back}
        />
      )}
    </div>
  );
}
