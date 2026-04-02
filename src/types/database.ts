/**
 * Database types for Supabase.
 * In production, generate these with: npx supabase gen types typescript
 * This file provides manual types for the bootstrap schema.
 */

export type UserRole = 'guest' | 'staff' | 'manager' | 'admin' | 'owner';

export type BookingStatus =
  | 'inquiry'
  | 'quote_sent'
  | 'confirmed'
  | 'deposit_paid'
  | 'paid_in_full'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'lost';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  preferred_language: string;
  preferred_currency: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  reference_code: string;
  profile_id: string;
  lead_id: string | null;
  status: BookingStatus;
  check_in: string;
  check_out: string;
  num_guests: number;
  total_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingParticipant {
  id: string;
  booking_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  dietary_requirements: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      leads: {
        Row: Lead;
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Lead, 'id' | 'created_at'>>;
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, 'id' | 'reference_code' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Booking, 'id' | 'reference_code' | 'created_at'>>;
      };
      booking_participants: {
        Row: BookingParticipant;
        Insert: Omit<BookingParticipant, 'id' | 'created_at'>;
        Update: Partial<Omit<BookingParticipant, 'id' | 'created_at'>>;
      };
    };
  };
}
