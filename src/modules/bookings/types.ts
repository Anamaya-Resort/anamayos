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
