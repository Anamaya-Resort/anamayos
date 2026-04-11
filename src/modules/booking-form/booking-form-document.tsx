'use client';

import { useState } from 'react';
import Image from 'next/image';
import { RoomDetailModal, getRoomDetailData } from './room-detail-modal';
import type { TranslationKeys } from '@/i18n/en';

interface RetreatCard {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  categories: string[];
  max_capacity: number | null;
  available_spaces: number | null;
  currency: string;
  deposit_percentage: number;
  leader_name: string | null;
  image_url: string | null;
  status: string;
}

interface RoomCard {
  id: string;
  name: string;
  maxOccupancy: number;
  isShared: boolean;
  ratePerNight: number | null;
  currency: string;
  roomGroup: string;
  category: string;
  description: string | null;
  heroImage: string | null;
  beds: Array<{ label: string; bedType: string }>;
}

interface BookingFormDocumentProps {
  dict: TranslationKeys;
  retreats: RetreatCard[];
  rooms: RoomCard[];
}

function Field({ label, value, onChange, type = 'text', placeholder, half }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; half?: boolean;
}) {
  return (
    <div className={`bf-field ${half ? 'bf-field-half' : ''}`}>
      <label className="bf-label">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className="bf-input" />
    </div>
  );
}

function Section({ title, number }: { title: string; number: number }) {
  return (
    <div className="bf-section-header">
      <span className="bf-section-number">{number}</span>
      <span className="bf-section-title">{title}</span>
    </div>
  );
}

function Check({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="bf-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Format date range nicely */
function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const s = new Date(start + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startStr = `${months[s.getMonth()]} ${s.getDate()}`;
  if (!end) return startStr;
  const e = new Date(end + 'T12:00:00');
  const endStr = s.getMonth() === e.getMonth()
    ? `${e.getDate()}`
    : `${months[e.getMonth()]} ${e.getDate()}`;
  return `${startStr} – ${endStr}, ${s.getFullYear()}`;
}

/** Calculate nights */
function calcNights(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function BookingFormDocument({ dict, retreats, rooms }: BookingFormDocumentProps) {
  const [form, setForm] = useState({
    retreat_id: '',
    check_in: '', check_out: '', room_id: '', num_guests: '1',
    first_name: '', last_name: '', email: '', phone: '', whatsapp: '',
    instagram: '', date_of_birth: '', gender: '', nationality: '',
    country: '', city: '', address: '', passport_number: '',
    dietary_vegetarian: false, dietary_vegan: false, dietary_gf: false,
    dietary_df: false, dietary_nut_allergy: false, dietary_other: '',
    medical_conditions: '', medications: '', injuries: '',
    fitness_level: '', yoga_experience: '',
    ec_name: '', ec_relationship: '', ec_phone: '', ec_email: '',
    arrival_date: '', arrival_time: '', arrival_airport: '',
    arrival_flight: '', arrival_airline: '', arrival_transport: 'self',
    arrival_notes: '',
    departure_date: '', departure_time: '', departure_airport: '',
    departure_flight: '', departure_airline: '', departure_transport: 'self',
    departure_notes: '',
    addon_yoga: false, addon_surf: false, addon_spa: false,
    addon_zipline: false, addon_snorkeling: false,
    addon_airport_transfer: false, addon_other: '',
    total_amount: '', deposit_amount: '', deposit_paid: false,
    balance_due: '', payment_method: '', discount_code: '',
    special_requests: '', internal_notes: '',
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const [retreatModalOpen, setRetreatModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [detailRoom, setDetailRoom] = useState<RoomCard | null>(null);

  const selectedRetreat = retreats.find((r) => r.id === form.retreat_id);
  const selectedRoom = rooms.find((r) => r.id === form.room_id);

  // When retreat is selected, auto-fill dates
  function selectRetreat(id: string) {
    const retreat = retreats.find((r) => r.id === id);
    setForm((prev) => ({
      ...prev,
      retreat_id: id,
      check_in: retreat?.start_date || prev.check_in,
      check_out: retreat?.end_date || prev.check_out,
      arrival_date: retreat?.start_date || prev.arrival_date,
      departure_date: retreat?.end_date || prev.departure_date,
    }));
  }

  return (
    <div className="bf-document-wrapper">
      {/* ==================== PAGE 1 ==================== */}
      <div className="bf-page">
        <div className="bf-page-header">
          <Image src="/AnamayaOS_full_logo_800px_black.webp" alt="Anamaya" width={140} height={28} className="bf-logo" />
          <span className="bf-page-title">Guest Registration Form</span>
        </div>
        <Image src="/flower-divider.png" alt="" width={600} height={12} className="bf-divider" />

        {/* Section 1: Retreat & Stay Details */}
        <Section number={1} title="Retreat & Stay Details" />
        <div className="bf-field-grid">
          <div className="bf-field bf-field-full">
            <label className="bf-label">Retreat / Program</label>
            <button type="button" onClick={() => setRetreatModalOpen(true)} className="bf-input bf-input-selector">
              {selectedRetreat ? selectedRetreat.name : 'Click to select a retreat...'}
            </button>
          </div>
          <Field label="Check-in" value={form.check_in} onChange={(v) => set('check_in', v)} type="date" half />
          <Field label="Check-out" value={form.check_out} onChange={(v) => set('check_out', v)} type="date" half />
          <div className="bf-field bf-field-full">
            <label className="bf-label">Room</label>
            <button type="button" onClick={() => setRoomModalOpen(true)} className="bf-input bf-input-selector">
              {selectedRoom ? `${selectedRoom.name} — ${selectedRoom.category} (${selectedRoom.maxOccupancy} ${selectedRoom.isShared ? 'beds' : 'guests'})` : 'Click to select a room...'}
            </button>
          </div>
          <Field label="# Guests" value={form.num_guests} onChange={(v) => set('num_guests', v)} type="number" half />
        </div>

        {/* Section 3: Guest Information */}
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

        <Section number={4} title="Emergency Contact" />
        <div className="bf-field-grid">
          <Field label="Full Name" value={form.ec_name} onChange={(v) => set('ec_name', v)} half />
          <Field label="Relationship" value={form.ec_relationship} onChange={(v) => set('ec_relationship', v)} half />
          <Field label="Phone" value={form.ec_phone} onChange={(v) => set('ec_phone', v)} half />
          <Field label="Email" value={form.ec_email} onChange={(v) => set('ec_email', v)} half />
        </div>

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

        <Section number={7} title="Payment Summary" />
        <div className="bf-field-grid">
          <Field label="Total Amount" value={form.total_amount} onChange={(v) => set('total_amount', v)} half />
          <Field label={`Deposit (${selectedRetreat?.deposit_percentage ?? 50}%)`} value={form.deposit_amount} onChange={(v) => set('deposit_amount', v)} half />
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

        <Section number={8} title="Special Requests & Notes" />
        <div className="bf-field-grid">
          <Field label="Guest requests" value={form.special_requests} onChange={(v) => set('special_requests', v)} />
          <Field label="Internal staff notes" value={form.internal_notes} onChange={(v) => set('internal_notes', v)} />
        </div>

        <Image src="/flower-divider.png" alt="" width={600} height={12} className="bf-divider bf-divider-bottom" />
        <div className="bf-page-footer">Page 2 of 2</div>
      </div>

      {/* ==================== RETREAT SELECTION MODAL ==================== */}
      {retreatModalOpen && (
        <div className="bf-modal-overlay" onClick={() => setRetreatModalOpen(false)}>
          <div className="bf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bf-modal-header">
              <h2>Select Your Retreat</h2>
              <button onClick={() => setRetreatModalOpen(false)} className="bf-modal-close">×</button>
            </div>
            <div className="bf-modal-body">
              <div className="bf-retreat-grid">
                {retreats.map((retreat) => {
                  const nights = calcNights(retreat.start_date, retreat.end_date);
                  return (
                    <button
                      key={retreat.id}
                      type="button"
                      onClick={() => { selectRetreat(retreat.id); setTimeout(() => setRetreatModalOpen(false), 0); }}
                      className={`bf-retreat-card ${form.retreat_id === retreat.id ? 'bf-retreat-card-selected' : ''}`}
                    >
                      {retreat.image_url ? (
                        <div className="bf-retreat-card-img" style={{ backgroundImage: `url(${retreat.image_url})` }} />
                      ) : (
                        <div className="bf-retreat-card-img bf-retreat-card-img-empty" />
                      )}
                      <div className="bf-retreat-card-body">
                        <p className="bf-retreat-card-name">{retreat.name}</p>
                        <p className="bf-retreat-card-dates">
                          {formatDateRange(retreat.start_date, retreat.end_date)}
                          {nights ? ` · ${nights} nights` : ''}
                        </p>
                        {retreat.leader_name && <p className="bf-retreat-card-leader">{retreat.leader_name}</p>}
                        <div className="bf-retreat-card-tags">
                          {retreat.categories.slice(0, 3).map((c) => (
                            <span key={c} className="bf-retreat-card-tag">{c}</span>
                          ))}
                        </div>
                        {retreat.available_spaces != null && retreat.max_capacity != null && (
                          <p className="bf-retreat-card-spots">{retreat.available_spaces}/{retreat.max_capacity} spots</p>
                        )}
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { set('retreat_id', 'hotel'); setRetreatModalOpen(false); }}
                  className={`bf-retreat-card ${form.retreat_id === 'hotel' ? 'bf-retreat-card-selected' : ''}`}
                >
                  <div className="bf-retreat-card-img bf-retreat-card-img-empty" />
                  <div className="bf-retreat-card-body">
                    <p className="bf-retreat-card-name">Hotel / Custom Stay</p>
                    <p className="bf-retreat-card-dates">Choose your own dates</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ROOM SELECTION MODAL ==================== */}
      {roomModalOpen && (
        <div className="bf-modal-overlay" onClick={() => setRoomModalOpen(false)}>
          <div className="bf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bf-modal-header">
              <h2>Select Your Room</h2>
              <button onClick={() => setRoomModalOpen(false)} className="bf-modal-close">×</button>
            </div>
            <div className="bf-modal-body">
              {(() => {
                const upper = rooms.filter((r) => r.roomGroup === 'upper');
                const lower = rooms.filter((r) => r.roomGroup === 'lower');
                const other = rooms.filter((r) => r.roomGroup !== 'upper' && r.roomGroup !== 'lower');

                function renderRoomCard(room: RoomCard) {
                  return (
                    <div key={room.id} className={`bf-retreat-card ${form.room_id === room.id ? 'bf-retreat-card-selected' : ''}`}>
                      <button
                        type="button"
                        className="bf-card-enlarge"
                        onClick={(e) => { e.stopPropagation(); setDetailRoom(room); }}
                      >
                        Enlarge
                      </button>
                      <button
                        type="button"
                        onClick={() => { set('room_id', room.id); setRoomModalOpen(false); }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%', font: 'inherit' }}
                      >
                        {room.heroImage ? (
                          <div className="bf-retreat-card-img" style={{ backgroundImage: `url(${room.heroImage})` }} />
                        ) : (
                          <div className="bf-retreat-card-img bf-retreat-card-img-empty" />
                        )}
                        <div className="bf-retreat-card-body">
                          <p className="bf-retreat-card-name">{room.name}</p>
                          <p className="bf-retreat-card-dates">
                            {room.category} · {room.maxOccupancy} {room.isShared ? 'beds' : 'guests'}
                          </p>
                          {room.ratePerNight && (
                            <p className="bf-retreat-card-leader">${room.ratePerNight}/night</p>
                          )}
                          {room.beds.length > 0 && (
                            <div className="bf-retreat-card-tags">
                              {room.beds.map((b) => (
                                <span key={b.label} className="bf-retreat-card-tag">{b.label}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {upper.length > 0 && (
                      <>
                        <div className="bf-subsection-label" style={{ margin: '0 0 8px' }}>Upper Rooms</div>
                        <div className="bf-room-grid">{upper.map(renderRoomCard)}</div>
                      </>
                    )}
                    {lower.length > 0 && (
                      <>
                        <div className="bf-subsection-label" style={{ margin: '16px 0 8px' }}>Lower Rooms</div>
                        <div className="bf-room-grid">{lower.map(renderRoomCard)}</div>
                      </>
                    )}
                    {other.length > 0 && (
                      <>
                        <div className="bf-subsection-label" style={{ margin: '16px 0 8px' }}>Other</div>
                        <div className="bf-room-grid">{other.map(renderRoomCard)}</div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Room detail modal (opened by Enlarge button) */}
      {detailRoom && (() => {
        const data = getRoomDetailData(detailRoom.name);
        return (
          <RoomDetailModal
            room={detailRoom}
            images={data.images}
            description={data.description}
            onClose={() => setDetailRoom(null)}
          />
        );
      })()}
    </div>
  );
}
