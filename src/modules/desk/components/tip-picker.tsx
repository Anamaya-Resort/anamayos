'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { DESK_CONFIG } from '../config';
import { Chip } from './chip';
import { money } from './api';
import type { DeskLabels } from './labels';

/** No tip / preset % / custom amount. Reports the tip in currency. */
export function TipPicker({ base, currency, labels, value, onChange }: {
  base: number;
  currency: string;
  labels: DeskLabels;
  value: number;
  onChange: (tip: number) => void;
}) {
  const [mode, setMode] = useState<'none' | number | 'custom'>('none');
  const [custom, setCustom] = useState('');
  const pct = (p: number) => Math.round(base * p) / 100;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Chip selected={mode === 'none'} onClick={() => { setMode('none'); onChange(0); }}>{labels.noTip}</Chip>
        {DESK_CONFIG.tipPresets.map((p) => (
          <Chip key={p} selected={mode === p} onClick={() => { setMode(p); onChange(pct(p)); }}>
            <span className="block">{p}%</span>
            <span className="block text-xs font-normal tabular-nums opacity-80">{money(pct(p), currency)}</span>
          </Chip>
        ))}
        <Chip selected={mode === 'custom'} onClick={() => { setMode('custom'); onChange(Number(custom) || 0); }}>{labels.customTip}</Chip>
      </div>
      {mode === 'custom' && (
        <Input
          inputMode="decimal"
          autoFocus
          value={custom}
          aria-label={labels.customTip}
          placeholder="0"
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.]/g, '');
            setCustom(v);
            onChange(Math.min(10000, Number(v) || 0));
          }}
          className="h-11 max-w-40 text-base tabular-nums md:text-sm"
        />
      )}
      <span className="sr-only">{money(value, currency)}</span>
    </div>
  );
}
