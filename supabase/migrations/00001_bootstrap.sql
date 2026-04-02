-- AO Platform: Bootstrap schema
-- This migration creates the minimum tables for auth, profiles, leads, and bookings.

-- Custom types
CREATE TYPE user_role AS ENUM ('guest', 'staff', 'manager', 'admin', 'owner');
CREATE TYPE booking_status AS ENUM (
  'inquiry', 'quote_sent', 'confirmed', 'deposit_paid',
  'paid_in_full', 'checked_in', 'checked_out', 'cancelled', 'no_show'
);
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'guest',
  avatar_url TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  source TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE DEFAULT ('BK-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0')),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  lead_id UUID REFERENCES leads(id),
  status booking_status NOT NULL DEFAULT 'inquiry',
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_guests INT NOT NULL DEFAULT 1,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);

-- Booking participants
CREATE TABLE booking_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  dietary_requirements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bookings_profile ON bookings(profile_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_check_in ON bookings(check_in);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_participants_booking ON booking_participants(booking_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_participants ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own, staff+ can read all
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);

-- Leads: staff+ can read/write
CREATE POLICY leads_select ON leads FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
);
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
);
CREATE POLICY leads_update ON leads FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
);

-- Bookings: guests see own, staff+ see all
CREATE POLICY bookings_select ON bookings FOR SELECT USING (
  auth.uid() = profile_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
);
CREATE POLICY bookings_insert ON bookings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
);
CREATE POLICY bookings_update ON bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
);

-- Participants: same as booking access
CREATE POLICY participants_select ON booking_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND (
    bookings.profile_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
  ))
);
CREATE POLICY participants_insert ON booking_participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'admin', 'owner'))
);
