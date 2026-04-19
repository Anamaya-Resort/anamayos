'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Lock, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepRetreat } from './step-retreat';
import { StepGuests } from './step-guests';
import { StepRooms } from './step-rooms';
import { StepBed } from './step-bed';
import { StepInfo } from './step-info';
import type { GuestType } from '@/lib/booking-availability';

export interface WizardState {
  retreatId?: string;
  retreatName?: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  guestType: GuestType;
  roomId?: string;
  roomName?: string;
  bedIds: string[];
  bedArrangement?: string;
  bookingType?: string;
  needsApproval?: boolean;
  guestInfo: { fullName: string; email: string; phone: string };
  participants: Array<{ fullName: string; email: string }>;
}

export interface RetreatOption {
  id: string;
  name: string;
  excerpt: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  teacher: string | null;
  categories: string[];
  maxCapacity: number | null;
  availableSpaces: number | null;
  currency: string;
  depositPercentage: number;
  images: unknown[];
}

interface PanelProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  isLocked: boolean;
  lockMessage?: string;
  isComplete: boolean;
  children: React.ReactNode;
}

function Panel({ title, subtitle, isOpen, onToggle, isLocked, lockMessage, isComplete, children }: PanelProps) {
  return (
    <div className={`border rounded-lg transition-colors ${isLocked ? 'opacity-50' : ''} ${isComplete && !isOpen ? 'border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20' : ''}`}>
      <button
        onClick={isLocked ? undefined : onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'} transition-colors`}
      >
        {isLocked ? (
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : isComplete && !isOpen ? (
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
        ) : isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{title}</span>
          {subtitle && <span className="text-xs text-muted-foreground ml-2">{subtitle}</span>}
        </div>
        {isLocked && lockMessage && (
          <span className="text-[10px] text-muted-foreground">{lockMessage}</span>
        )}
      </button>
      {isOpen && !isLocked && (
        <div className="px-4 pb-4 border-t pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

interface BookingWizardProps {
  retreats: RetreatOption[];
}

export function BookingWizard({ retreats }: BookingWizardProps) {
  const router = useRouter();
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set(['retreat']));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; referenceCode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const toggle = (panel: string) => setOpenPanels((prev) => {
    const next = new Set(prev);
    if (next.has(panel)) next.delete(panel); else next.add(panel);
    return next;
  });

  // Dependency checks
  const hasRetreat = !!state.retreatId;
  const hasRoom = !!state.roomId;
  const hasBed = state.bedIds.length > 0;
  const hasGuestInfo = !!state.guestInfo.fullName && !!state.guestInfo.email;
  const canSubmit = hasRetreat && hasRoom && hasBed && hasGuestInfo;

  // Summary text for completed panels
  const retreatSummary = state.retreatName ?? undefined;
  const guestSummary = state.numGuests === 1 ? 'Solo' : `Couple — ${state.guestType === 'couple_shared' ? 'shared bed' : 'separate beds'}`;
  const roomSummary = state.roomName ?? undefined;
  const bedSummary = state.bedIds.length > 0 ? `${state.bookingType ?? ''} ${state.bedArrangement ? `(${state.bedArrangement.replace('_', ' ')})` : ''}`.trim() : undefined;
  const infoSummary = state.guestInfo.fullName || undefined;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retreatId: state.retreatId,
          roomId: state.roomId,
          bedIds: state.bedIds,
          checkIn: state.checkIn,
          checkOut: state.checkOut,
          numGuests: state.numGuests,
          bookingType: state.bookingType ?? 'Single Deluxe',
          bedArrangement: state.bedArrangement,
          guestInfo: state.guestInfo,
          participants: state.participants.filter((p) => p.fullName),
          needsApproval: state.needsApproval,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create booking');
        return;
      }
      const data = await res.json();
      setResult(data.booking);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="text-center space-y-6 py-12 max-w-lg mx-auto">
        <CheckCircle className="h-16 w-16 mx-auto text-status-success" />
        <div>
          <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
          <p className="text-muted-foreground mt-2">Reference: <span className="font-mono text-primary">{result.referenceCode}</span></p>
          {state.needsApproval && <p className="text-sm text-status-warning mt-1">This booking requires staff approval.</p>}
        </div>
        <Button onClick={() => router.push(`/dashboard/bookings/${result.id}`)}>View Booking Details</Button>
      </div>
    );
  }

  const steps = [
    { label: 'Retreat', done: hasRetreat },
    { label: 'Guests', done: hasRetreat },
    { label: 'Room', done: hasRoom },
    { label: 'Bed', done: hasBed },
    { label: 'Info', done: hasGuestInfo },
    { label: 'Confirm', done: false },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {/* Progress timeline */}
      <div className="flex items-center gap-1 mb-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${
              s.done ? 'bg-primary' : canSubmit && i === steps.length - 1 ? 'bg-primary/60' : 'bg-muted'
            }`} />
            <p className={`text-[10px] mt-1 text-center ${
              s.done ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 1. Retreat */}
      <Panel title="1. Select Retreat" subtitle={retreatSummary}
        isOpen={openPanels.has('retreat')} onToggle={() => toggle('retreat')}
        isLocked={false} isComplete={hasRetreat}>
        <StepRetreat retreats={retreats} state={state} onUpdate={update} onNext={() => { toggle('retreat'); toggle('guests'); }} />
      </Panel>

      {/* 2. Guests */}
      <Panel title="2. Guests" subtitle={hasRetreat ? guestSummary : undefined}
        isOpen={openPanels.has('guests')} onToggle={() => toggle('guests')}
        isLocked={false} isComplete={hasRetreat}>
        <StepGuests state={state} onUpdate={update} onNext={() => { toggle('guests'); toggle('rooms'); }} onBack={() => { toggle('guests'); toggle('retreat'); }} />
      </Panel>

      {/* 3. Room — requires retreat */}
      <Panel title="3. Choose Room" subtitle={roomSummary}
        isOpen={openPanels.has('rooms')} onToggle={() => toggle('rooms')}
        isLocked={!hasRetreat} lockMessage="Select a retreat first"
        isComplete={hasRoom}>
        <StepRooms state={state} onUpdate={update} onNext={() => { toggle('rooms'); toggle('bed'); }} onBack={() => { toggle('rooms'); toggle('guests'); }} />
      </Panel>

      {/* 4. Bed — requires room */}
      <Panel title="4. Pick Your Bed" subtitle={bedSummary}
        isOpen={openPanels.has('bed')} onToggle={() => toggle('bed')}
        isLocked={!hasRoom} lockMessage="Choose a room first"
        isComplete={hasBed}>
        <StepBed state={state} onUpdate={update} onNext={() => { toggle('bed'); toggle('info'); }} onBack={() => { toggle('bed'); toggle('rooms'); }} />
      </Panel>

      {/* 5. Guest Info — always accessible */}
      <Panel title="5. Your Details" subtitle={infoSummary}
        isOpen={openPanels.has('info')} onToggle={() => toggle('info')}
        isLocked={false} isComplete={hasGuestInfo}>
        <StepInfo state={state} onUpdate={update} onNext={() => toggle('info')} onBack={() => { toggle('info'); toggle('bed'); }} />
      </Panel>

      {/* Confirm button */}
      <div className="border rounded-lg p-4 space-y-3">
        {!canSubmit && (
          <p className="text-sm text-muted-foreground">
            Complete all sections above to confirm your booking.
          </p>
        )}
        {error && (
          <p className="text-sm text-status-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
        )}
        <Button onClick={submit} disabled={!canSubmit || submitting} className="w-full gap-2" size="lg">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {state.needsApproval ? 'Request Booking (Requires Approval)' : 'Confirm Booking'}
        </Button>
      </div>
    </div>
  );
}
