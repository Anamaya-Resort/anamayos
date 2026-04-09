/** A room row in the calendar grid */
export interface CalendarRoom {
  id: string;
  name: string;
  maxOccupancy: number;
  category: string;
  ratePerNight: number | null;
  currency: string;
  isShared: boolean;
}

/** A booking bar to render in the grid */
export interface CalendarBooking {
  id: string;
  guestName: string;
  retreatName: string | null;
  roomId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  status: string;
  guestType: string;
  numGuests: number;
}

/** A room block overlay */
export interface CalendarRoomBlock {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  roomIds: string[];
  blockType: string;
}

/** Calendar view configuration */
export interface CalendarConfig {
  startDate: string;
  numDays: number;
}

/** Status → color mapping (configurable) */
export const BOOKING_STATUS_COLORS: Record<string, string> = {
  confirmed: 'var(--cal-confirmed)',
  deposit_paid: 'var(--cal-deposit)',
  paid_in_full: 'var(--cal-paid)',
  checked_in: 'var(--cal-checked-in)',
  checked_out: 'var(--cal-checked-out)',
  inquiry: 'var(--cal-inquiry)',
  quote_sent: 'var(--cal-quote)',
  cancelled: 'var(--cal-cancelled)',
  no_show: 'var(--cal-no-show)',
};

/** Guest type → color variant */
export const GUEST_TYPE_COLORS: Record<string, string> = {
  participant: 'var(--cal-participant)',
  'program-staff': 'var(--cal-program-staff)',
};
