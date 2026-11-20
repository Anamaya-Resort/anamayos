'use client';

import type { SpaOption, SpaTreatment } from '../types';
import { Chip } from './chip';
import { money } from './api';
import type { DeskLabels } from './labels';

/** Spa menu grouped by category; tap a length to start booking it. */
export function TreatmentList({ treatments, currency, labels, onPick }: {
  treatments: SpaTreatment[];
  currency: string;
  labels: DeskLabels;
  onPick: (t: SpaTreatment, o: SpaOption) => void;
}) {
  const groups: { category: string; items: SpaTreatment[] }[] = [];
  for (const t of treatments) {
    const g = groups.find((x) => x.category === t.category);
    if (g) g.items.push(t);
    else groups.push({ category: t.category, items: [t] });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.category} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.category}</h3>
          <ul className="grid gap-2 @xl:grid-cols-2">
            {g.items.map((t) => (
              <li key={t.key} className="rounded-lg border border-border bg-card p-3">
                <p className="font-medium">{t.name}</p>
                {t.providers.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">{t.providers.map((p) => p.name.split(' ')[0]).join(', ')}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.options.map((o) => (
                    <Chip key={o.serviceId} onClick={() => onPick(t, o)} className="flex-1 basis-24">
                      <span className="block text-xs font-normal opacity-80">{o.minutes} {labels.min}</span>
                      <span className="block tabular-nums">{money(o.price, currency)}</span>
                    </Chip>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
