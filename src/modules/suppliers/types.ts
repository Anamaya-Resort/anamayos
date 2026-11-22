export type SupplierKind = 'excursions' | 'transport';

export interface SupplierOption {
  id: string;
  name: string;
  price: number;
  net: number | null;
}

export interface SupplierItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number | null;
  net: number | null;
  priceUnit: string | null;
  onRequest: boolean;
  priceNotes: string | null;
  minutes: number | null;
  minPeople: number | null;
  maxPeople: number | null;
  minAge: number | null;
  schedule: string | null;
  season: string | null;
  includes: string | null;
  bring: string | null;
  meetingPoint: string | null;
  cancellation: string | null;
  internalNotes: string | null;
  options: SupplierOption[];
}

export interface Supplier {
  id: string;
  name: string;
  legalName: string | null;
  kinds: SupplierKind[];
  contactName: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  bookingNotes: string | null;
  cancellation: string | null;
  paymentTerms: string | null;
  policies: Record<string, string>;
  verifiedAt: string | null;
  verificationNotes: string | null;
  notes: string | null;
  isActive: boolean;
  items: SupplierItem[];
}
