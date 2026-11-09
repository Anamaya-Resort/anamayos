import type { Booking, BookingParticipant, BookingStatus } from '@/types';

/** Payment status derived from transactions */
export type PaymentState = 'no_payment' | 'deposit_paid' | 'partial' | 'paid_in_full' | 'overdue' | 'not_applicable';

/** Booking with joined profile name for list views */
export interface BookingListItem extends Booking {
  guest_name: string | null;
  guest_email: string;
  room_name: string | null;
  retreat_name: string | null;
  is_sub_booking: boolean;
  guest_type: string;
  amount_paid: number;
  balance_due: number;
  payment_state: PaymentState;
}

/** Full booking with participants, guest info, retreat, room, and payment data */
export interface BookingDetail extends Booking {
  guest_name: string | null;
  guest_email: string;
  guest_phone?: string | null;
  guest_gender?: string | null;
  guest_country?: string | null;
  guest_city?: string | null;
  guest_nationality?: string | null;
  guest_whatsapp?: string | null;
  guest_dob?: string | null;
  participants: BookingParticipant[];
  retreat_name?: string | null;
  retreat_teacher?: string | null;
  room_name?: string | null;
  lodging_type_name?: string | null;
  layout_json?: Record<string, unknown> | null;
  layout_unit?: string;
  room_beds?: Array<{ id: string; label: string; bedType: string; capacity: number }>;
  transactions?: Array<{ id: string; trans_date: string | null; class: string; category: string; status: string; description: string | null; charge_amount: number; credit_amount: number; grand_total: number }>;
  retreat_data?: {
    id: string; name: string; start_date: string | null; end_date: string | null;
    status: string; categories: string[]; excerpt: string | null; description: string | null;
    max_capacity: number | null; available_spaces: number | null; images: unknown;
    teacher: string | null; feature_image_url: string | null;
  } | null;
}

/** Filter state for the bookings list */
export interface BookingFilters {
  search: string;
  status: BookingStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Future entity stubs — these will be implemented as the module grows.
 * Listed here as a map for the module's planned scope.
 */
export type BookingModuleEntities =
  | 'booking_quotes'
  | 'bookings'
  | 'booking_participants'
  | 'rooming_requests'
  | 'room_assignments'
  | 'waitlists'
  | 'transport_requests'
  | 'folios';

/** One slot on the occupancy x axis: a month (1-12) or an ISO week (1-53). */
export interface OccupancyBucket {
  n: number;
  /** Keyed by year as a string, e.g. "2026". */
  counts: Record<string, number>;
}

/** One drawable view of occupancy. Years live on OccupancyData, shared. */
export interface OccupancySeries {
  kind: 'month' | 'week';
  buckets: OccupancyBucket[];
  totals: Record<string, number>;
  peak: Record<string, number>;
}

export interface OccupancyData {
  years: string[];
  monthly: OccupancySeries;
  weekly: OccupancySeries;
  /** Teacher trainings only, by month. */
  ytt: OccupancySeries;
  /** Total booking-weeks: a 3 week training counts 3 times. */
  guestWeeks: number;
  /** Distinct bookings behind those weeks. */
  bookingsCounted: number;
  /** How many of those bookings sit on a retreat longer than a week. */
  multiWeekBookings: number;
}
