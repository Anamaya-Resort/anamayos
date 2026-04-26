'use client';

import type { RetreatData } from '../retreat-editor';

const RETREAT_TYPES = [
  'adventure','ayahuasca_ceremony','ayurveda','breathwork','couples','creativity',
  'detox_cleanse','digital_detox','fasting','fitness_bootcamp','longevity','meditation',
  'mindfulness','nutrition','personal_development','plant_medicine','prenatal',
  'recovery_rehab','reiki','retreat_leader_training','silence','sound_healing',
  'spiritual','surf','tantra','teacher_training_200hr','teacher_training_300hr',
  'teacher_training_500hr','wellness','womens','mens','yoga','yoga_and_surf','custom',
];

function typeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  retreat: RetreatData;
  onChange: (partial: Record<string, unknown>) => void;
}

export function BasicsPanel({ retreat, onChange }: Props) {
  const dateType = (retreat.date_type as string) ?? 'fixed';

  return (
    <div className="space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Field label="Retreat Name *">
            <input value={(retreat.name as string) ?? ''} onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Jungle Yoga Retreat" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <Field label="Tagline">
            <input value={(retreat.tagline as string) ?? ''} onChange={(e) => onChange({ tagline: e.target.value })}
              placeholder="One-line marketing hook" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Retreat Type">
            <select value={(retreat.retreat_type as string) ?? 'yoga'} onChange={(e) => onChange({ retreat_type: e.target.value })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
              {RETREAT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
          </Field>
          {retreat.retreat_type === 'custom' && (
            <Field label="Custom Type">
              <input value={(retreat.retreat_type_custom as string) ?? ''} onChange={(e) => onChange({ retreat_type_custom: e.target.value })}
                placeholder="Describe your retreat type" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            </Field>
          )}
          <Field label="Skill Level">
            <select value={(retreat.skill_level as string) ?? 'all_levels'} onChange={(e) => onChange({ skill_level: e.target.value })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
              <option value="all_levels">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>
          <Field label="Primary Language">
            <select value={(retreat.primary_language as string) ?? 'en'} onChange={(e) => onChange({ primary_language: e.target.value })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="it">Italian</option>
            </select>
          </Field>
          <Field label="Secondary Language">
            <select value={(retreat.secondary_language as string) ?? ''} onChange={(e) => onChange({ secondary_language: e.target.value || null })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
              <option value="">None</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="it">Italian</option>
            </select>
          </Field>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Date Type">
            <select value={dateType} onChange={(e) => onChange({ date_type: e.target.value })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
              <option value="fixed">Fixed Dates</option>
              <option value="package">Package (nights)</option>
              <option value="hotel">Hotel (flexible)</option>
              <option value="dateless">Dateless</option>
            </select>
          </Field>
          {(dateType === 'fixed' || dateType === 'package') && (
            <Field label="Start Date">
              <input type="date" value={(retreat.start_date as string) ?? ''} onChange={(e) => onChange({ start_date: e.target.value || null })}
                className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            </Field>
          )}
          {dateType === 'fixed' && (
            <Field label="End Date">
              <input type="date" value={(retreat.end_date as string) ?? ''} onChange={(e) => onChange({ end_date: e.target.value || null })}
                className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            </Field>
          )}
          {dateType === 'package' && (
            <Field label="Package Nights">
              <input type="number" value={(retreat.package_nights as number) ?? ''} min={1}
                onChange={(e) => onChange({ package_nights: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            </Field>
          )}
          <Field label="Registration Deadline">
            <input type="date" value={(retreat.registration_deadline as string) ?? ''} onChange={(e) => onChange({ registration_deadline: e.target.value || null })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
        </div>

        {/* Times & Capacity */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Field label="Check-in Time">
            <input type="time" value={(retreat.check_in_time as string) ?? '15:00'} onChange={(e) => onChange({ check_in_time: e.target.value })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <Field label="Check-out Time">
            <input type="time" value={(retreat.check_out_time as string) ?? '11:00'} onChange={(e) => onChange({ check_out_time: e.target.value })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <Field label="Max Capacity">
            <input type="number" value={(retreat.max_capacity as number) ?? ''} min={1}
              onChange={(e) => onChange({ max_capacity: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <Field label="Min Capacity">
            <input type="number" value={(retreat.min_capacity as number) ?? ''} min={1}
              onChange={(e) => onChange({ min_capacity: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
          <Field label="Min Age">
            <input type="number" value={(retreat.minimum_age as number) ?? ''} min={0}
              onChange={(e) => onChange({ minimum_age: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
          </Field>
        </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
