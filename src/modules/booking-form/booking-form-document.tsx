'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import type { TranslationKeys } from '@/i18n/en';

interface BookingFormDocumentProps {
  dict: TranslationKeys;
  retreats: Array<{ id: string; name: string; start_date: string | null; end_date: string | null }>;
  rooms: Array<{ id: string; name: string; maxOccupancy: number; isShared: boolean }>;
}

/** A labeled field row — label on left, input on right */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  half,
  readonly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  half?: boolean;
  readonly?: boolean;
}) {
  return (
    <div className={`bf-field ${half ? 'bf-field-half' : ''}`}>
      <label className="bf-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readonly}
        className="bf-input"
      />
    </div>
  );
}

/** Section header */
function Section({ title, number }: { title: string; number: number }) {
  return (
    <div className="bf-section-header">
      <span className="bf-section-number">{number}</span>
      <span className="bf-section-title">{title}</span>
    </div>
  );
}

/** Checkbox field */
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="bf-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function BookingFormDocument({ dict, retreats, rooms }: BookingFormDocumentProps) {
  // Form state — all fields in one object for easy serialization
  const [form, setForm] = useState({
    // Retreat/Stay
    retreat_id: '',
    check_in: '',
    check_out: '',
    room_id: '',
    num_guests: '1',
    booking_type: 'retreat', // retreat, ytt, hotel

    // Guest 1 (primary)
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    instagram: '',
    date_of_birth: '',
    gender: '',
    nationality: '',
    country: '',
    city: '',
    address: '',
    passport_number: '',

    // Health & Dietary
    dietary_vegetarian: false,
    dietary_vegan: false,
    dietary_gf: false,
    dietary_df: false,
    dietary_nut_allergy: false,
    dietary_other: '',
    medical_conditions: '',
    medications: '',
    injuries: '',
    fitness_level: '',
    yoga_experience: '',

    // Emergency Contact
    ec_name: '',
    ec_relationship: '',
    ec_phone: '',
    ec_email: '',

    // Travel Itinerary
    arrival_date: '',
    arrival_time: '',
    arrival_airport: '',
    arrival_flight: '',
    arrival_airline: '',
    arrival_transport: 'self', // self, transfer, other
    arrival_notes: '',
    departure_date: '',
    departure_time: '',
    departure_airport: '',
    departure_flight: '',
    departure_airline: '',
    departure_transport: 'self',
    departure_notes: '',

    // Add-ons & Services
    addon_yoga: false,
    addon_surf: false,
    addon_spa: false,
    addon_zipline: false,
    addon_snorkeling: false,
    addon_airport_transfer: false,
    addon_other: '',

    // Payment
    total_amount: '',
    deposit_amount: '',
    deposit_paid: false,
    balance_due: '',
    payment_method: '',
    discount_code: '',

    // Notes
    special_requests: '',
    internal_notes: '',
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="bf-document-wrapper">
      {/* ==================== PAGE 1 ==================== */}
      <div className="bf-page">
        {/* Header */}
        <div className="bf-page-header">
          <Image
            src="/AnamayaOS_full_logo_800px_black.webp"
            alt="Anamaya"
            width={140}
            height={28}
            className="bf-logo"
          />
          <span className="bf-page-title">Guest Registration Form</span>
        </div>

        {/* Top flower divider */}
        <Image src="/flower-divider.png" alt="" width={600} height={12} className="bf-divider" />

        {/* Section 1: Retreat / Stay Details */}
        <Section number={1} title="Retreat & Stay Details" />
        <div className="bf-field-grid">
          <div className="bf-field bf-field-full">
            <label className="bf-label">Retreat / Program</label>
            <select
              value={form.retreat_id}
              onChange={(e) => set('retreat_id', e.target.value)}
              className="bf-input"
            >
              <option value="">Select a retreat...</option>
              {retreats.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.start_date ? `(${r.start_date})` : ''}
                </option>
              ))}
              <option value="hotel">Hotel / Custom Stay</option>
            </select>
          </div>
          <Field label="Check-in" value={form.check_in} onChange={(v) => set('check_in', v)} type="date" half />
          <Field label="Check-out" value={form.check_out} onChange={(v) => set('check_out', v)} type="date" half />
          <div className="bf-field bf-field-half">
            <label className="bf-label">Room</label>
            <select value={form.room_id} onChange={(e) => set('room_id', e.target.value)} className="bf-input">
              <option value="">Select room...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.maxOccupancy} {r.isShared ? 'beds' : 'guests'})
                </option>
              ))}
            </select>
          </div>
          <Field label="# Guests" value={form.num_guests} onChange={(v) => set('num_guests', v)} type="number" half />
        </div>

        {/* Section 2: Guest Information */}
        <Section number={2} title="Guest Information" />
        <div className="bf-field-grid">
          <Field label="First Name" value={form.first_name} onChange={(v) => set('first_name', v)} half />
          <Field label="Last Name" value={form.last_name} onChange={(v) => set('last_name', v)} half />
          <Field label="Email" value={form.email} onChange={(v) => set('email', v)} type="email" half />
          <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} half />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} half />
          <Field label="Instagram" value={form.instagram} onChange={(v) => set('instagram', v)} placeholder="@handle" half />
          <Field label="Date of Birth" value={form.date_of_birth} onChange={(v) => set('date_of_birth', v)} type="date" half />
          <Field label="Gender" value={form.gender} onChange={(v) => set('gender', v)} half />
          <Field label="Nationality" value={form.nationality} onChange={(v) => set('nationality', v)} half />
          <Field label="Country" value={form.country} onChange={(v) => set('country', v)} half />
          <Field label="City" value={form.city} onChange={(v) => set('city', v)} half />
          <Field label="Passport #" value={form.passport_number} onChange={(v) => set('passport_number', v)} half />
          <Field label="Address" value={form.address} onChange={(v) => set('address', v)} />
        </div>

        {/* Section 3: Health & Dietary */}
        <Section number={3} title="Health & Dietary" />
        <div className="bf-subsection-label">Dietary Preferences</div>
        <div className="bf-check-grid">
          <Check label="Vegetarian" checked={form.dietary_vegetarian} onChange={(v) => set('dietary_vegetarian', v)} />
          <Check label="Vegan" checked={form.dietary_vegan} onChange={(v) => set('dietary_vegan', v)} />
          <Check label="Gluten-free" checked={form.dietary_gf} onChange={(v) => set('dietary_gf', v)} />
          <Check label="Dairy-free" checked={form.dietary_df} onChange={(v) => set('dietary_df', v)} />
          <Check label="Nut allergy" checked={form.dietary_nut_allergy} onChange={(v) => set('dietary_nut_allergy', v)} />
        </div>
        <div className="bf-field-grid">
          <Field label="Other dietary needs" value={form.dietary_other} onChange={(v) => set('dietary_other', v)} />
          <Field label="Medical conditions" value={form.medical_conditions} onChange={(v) => set('medical_conditions', v)} />
          <Field label="Medications" value={form.medications} onChange={(v) => set('medications', v)} />
          <Field label="Injuries / limitations" value={form.injuries} onChange={(v) => set('injuries', v)} />
          <Field label="Fitness level" value={form.fitness_level} onChange={(v) => set('fitness_level', v)} placeholder="beginner, moderate, active..." half />
          <Field label="Yoga experience" value={form.yoga_experience} onChange={(v) => set('yoga_experience', v)} placeholder="none, beginner, intermediate, advanced..." half />
        </div>

        {/* Bottom flower divider */}
        <Image src="/flower-divider.png" alt="" width={600} height={12} className="bf-divider bf-divider-bottom" />
        <div className="bf-page-footer">Page 1 of 2</div>
      </div>

      {/* ==================== PAGE 2 ==================== */}
      <div className="bf-page">
        <div className="bf-page-header">
          <Image src="/AnamayaOS_full_logo_800px_black.webp" alt="Anamaya" width={140} height={28} className="bf-logo" />
          <span className="bf-page-title">Guest Registration Form</span>
        </div>
        <Image src="/flower-divider.png" alt="" width={600} height={12} className="bf-divider" />

        {/* Section 4: Emergency Contact */}
        <Section number={4} title="Emergency Contact" />
        <div className="bf-field-grid">
          <Field label="Full Name" value={form.ec_name} onChange={(v) => set('ec_name', v)} half />
          <Field label="Relationship" value={form.ec_relationship} onChange={(v) => set('ec_relationship', v)} half />
          <Field label="Phone" value={form.ec_phone} onChange={(v) => set('ec_phone', v)} half />
          <Field label="Email" value={form.ec_email} onChange={(v) => set('ec_email', v)} half />
        </div>

        {/* Section 5: Travel Itinerary */}
        <Section number={5} title="Travel Itinerary" />
        <div className="bf-subsection-label">Arrival</div>
        <div className="bf-field-grid">
          <Field label="Date" value={form.arrival_date} onChange={(v) => set('arrival_date', v)} type="date" half />
          <Field label="Time" value={form.arrival_time} onChange={(v) => set('arrival_time', v)} type="time" half />
          <Field label="Airport" value={form.arrival_airport} onChange={(v) => set('arrival_airport', v)} placeholder="SJO or LIR" half />
          <Field label="Flight #" value={form.arrival_flight} onChange={(v) => set('arrival_flight', v)} half />
          <Field label="Airline" value={form.arrival_airline} onChange={(v) => set('arrival_airline', v)} half />
          <div className="bf-field bf-field-half">
            <label className="bf-label">Transport to Anamaya</label>
            <select value={form.arrival_transport} onChange={(e) => set('arrival_transport', e.target.value)} className="bf-input">
              <option value="self">Self-arranged</option>
              <option value="transfer">Airport transfer (Anamaya)</option>
              <option value="shuttle">Shared shuttle</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Field label="Arrival notes" value={form.arrival_notes} onChange={(v) => set('arrival_notes', v)} />
        </div>

        <div className="bf-subsection-label">Departure</div>
        <div className="bf-field-grid">
          <Field label="Date" value={form.departure_date} onChange={(v) => set('departure_date', v)} type="date" half />
          <Field label="Time" value={form.departure_time} onChange={(v) => set('departure_time', v)} type="time" half />
          <Field label="Airport" value={form.departure_airport} onChange={(v) => set('departure_airport', v)} placeholder="SJO or LIR" half />
          <Field label="Flight #" value={form.departure_flight} onChange={(v) => set('departure_flight', v)} half />
          <Field label="Airline" value={form.departure_airline} onChange={(v) => set('departure_airline', v)} half />
          <div className="bf-field bf-field-half">
            <label className="bf-label">Transport from Anamaya</label>
            <select value={form.departure_transport} onChange={(e) => set('departure_transport', e.target.value)} className="bf-input">
              <option value="self">Self-arranged</option>
              <option value="transfer">Airport transfer (Anamaya)</option>
              <option value="shuttle">Shared shuttle</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Field label="Departure notes" value={form.departure_notes} onChange={(v) => set('departure_notes', v)} />
        </div>

        {/* Section 6: Add-ons & Services */}
        <Section number={6} title="Add-ons & Services" />
        <div className="bf-check-grid">
          <Check label="Yoga classes" checked={form.addon_yoga} onChange={(v) => set('addon_yoga', v)} />
          <Check label="Surf lessons" checked={form.addon_surf} onChange={(v) => set('addon_surf', v)} />
          <Check label="Spa treatments" checked={form.addon_spa} onChange={(v) => set('addon_spa', v)} />
          <Check label="Zipline canopy tour" checked={form.addon_zipline} onChange={(v) => set('addon_zipline', v)} />
          <Check label="Snorkeling boat tour" checked={form.addon_snorkeling} onChange={(v) => set('addon_snorkeling', v)} />
          <Check label="Airport transfer" checked={form.addon_airport_transfer} onChange={(v) => set('addon_airport_transfer', v)} />
        </div>
        <div className="bf-field-grid">
          <Field label="Other requests" value={form.addon_other} onChange={(v) => set('addon_other', v)} />
        </div>

        {/* Section 7: Payment Summary */}
        <Section number={7} title="Payment Summary" />
        <div className="bf-field-grid">
          <Field label="Total Amount" value={form.total_amount} onChange={(v) => set('total_amount', v)} half />
          <Field label="Deposit (50%)" value={form.deposit_amount} onChange={(v) => set('deposit_amount', v)} half />
          <Field label="Balance Due at Check-in" value={form.balance_due} onChange={(v) => set('balance_due', v)} half />
          <Field label="Payment Method" value={form.payment_method} onChange={(v) => set('payment_method', v)} placeholder="Card, PayPal, Cash, Wire..." half />
          <Field label="Discount Code" value={form.discount_code} onChange={(v) => set('discount_code', v)} half />
          <div className="bf-field bf-field-half">
            <label className="bf-label">Deposit Paid</label>
            <div className="bf-check-inline">
              <Check label="Yes" checked={form.deposit_paid} onChange={(v) => set('deposit_paid', v)} />
            </div>
          </div>
        </div>

        {/* Section 8: Special Requests & Notes */}
        <Section number={8} title="Special Requests & Notes" />
        <div className="bf-field-grid">
          <Field label="Guest requests" value={form.special_requests} onChange={(v) => set('special_requests', v)} />
          <Field label="Internal staff notes" value={form.internal_notes} onChange={(v) => set('internal_notes', v)} />
        </div>

        <Image src="/flower-divider.png" alt="" width={600} height={12} className="bf-divider bf-divider-bottom" />
        <div className="bf-page-footer">Page 2 of 2</div>
      </div>
    </div>
  );
}
