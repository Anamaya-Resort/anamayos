'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, Users, Heart, ArrowLeftRight } from 'lucide-react';
import type { WizardState } from './booking-wizard';
import type { GuestType } from '@/lib/booking-availability';

interface StepGuestsProps {
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepGuests({ state, onUpdate, onNext, onBack }: StepGuestsProps) {
  const setGuestType = (type: GuestType, numGuests: number) => {
    onUpdate({ guestType: type, numGuests });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Who&apos;s Coming?</h2>
        <p className="text-sm text-muted-foreground">Tell us about your group so we can show the best room options.</p>
      </div>

      {/* Solo vs Couple */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${state.guestType === 'solo' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setGuestType('solo', 1)}>
          <CardContent className="p-6 text-center space-y-3">
            <User className="h-10 w-10 mx-auto text-primary" />
            <h3 className="font-semibold">Just Me</h3>
            <p className="text-xs text-muted-foreground">Solo traveler — I&apos;ll have my own bed</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${state.guestType !== 'solo' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setGuestType('couple_shared', 2)}>
          <CardContent className="p-6 text-center space-y-3">
            <Users className="h-10 w-10 mx-auto text-primary" />
            <h3 className="font-semibold">Me + Partner/Friend</h3>
            <p className="text-xs text-muted-foreground">Traveling as a pair</p>
          </CardContent>
        </Card>
      </div>

      {/* Bed preference for couples */}
      {state.numGuests >= 2 && (
        <div>
          <h3 className="text-sm font-medium mb-3">How would you like to sleep?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${state.guestType === 'couple_shared' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setGuestType('couple_shared', 2)}>
              <CardContent className="p-5 text-center space-y-2">
                <Heart className="h-8 w-8 mx-auto text-pink-500" />
                <h4 className="font-medium text-sm">Shared Bed</h4>
                <p className="text-[11px] text-muted-foreground">Queen bed or split king (two beds joined together)</p>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${state.guestType === 'couple_separate' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setGuestType('couple_separate', 2)}>
              <CardContent className="p-5 text-center space-y-2">
                <ArrowLeftRight className="h-8 w-8 mx-auto text-blue-500" />
                <h4 className="font-medium text-sm">Separate Beds</h4>
                <p className="text-[11px] text-muted-foreground">Two individual single beds in the same room</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next: Choose Room</Button>
      </div>
    </div>
  );
}
