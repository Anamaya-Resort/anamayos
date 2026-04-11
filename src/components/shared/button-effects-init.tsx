'use client';

import { useEffect } from 'react';
import { initButtonEffects } from '@/lib/button-effects';

/** Drop this into the root layout to enable button effects globally. */
export function ButtonEffectsInit() {
  useEffect(() => {
    initButtonEffects();
  }, []);

  return null;
}
