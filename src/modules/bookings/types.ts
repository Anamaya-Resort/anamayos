import type { Booking, BookingParticipant, BookingStatus } from '@/types';

/** Booking with joined profile name for list views */
export interface BookingListItem extends Booking {
  guest_name: string | null;
  guest_email: string;
  room_name: string | null;
  retreat_name: string | null;
  is_sub_booking: boolean;
  guest_type: string;
}

/** Full booking with participants for detail view */
export interface BookingDetail extends Booking {
  guest_name: string | null;
  guest_email: string;
  participants: BookingParticipant[];
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
