import type { ShopTile } from './config';

export interface DeskGuest {
  bookingId: string;
  personId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  room: string | null;
  retreat: string | null;
  checkIn: string;
  checkOut: string;
  inHouse: boolean;
}

export interface SpaProvider {
  personId: string;
  name: string;
}

/** One bookable length of a treatment (e.g. Relaxing Massage, 60 min). */
export interface SpaOption {
  serviceId: string;
  productId: string;
  minutes: number;
  price: number;
}

export interface SpaTreatment {
  key: string;
  name: string;
  category: string;
  isAddon: boolean;
  options: SpaOption[];
  providers: SpaProvider[];
}

export interface ShopItem {
  productId: string;
  name: string;
  price: number;
  minutes: number | null;
  tile: ShopTile;
  category: string;
}

export interface SpaRoom {
  id: string;
  name: string;
}

export interface DeskCatalog {
  date: string;
  currency: string;
  ivaRate: number;
  rooms: SpaRoom[];
  /** Everyone on the spa team; a treatment's `providers` are its usual ones. */
  therapists: SpaProvider[];
  treatments: SpaTreatment[];
  addons: SpaTreatment[];
  items: ShopItem[];
}

export interface DeskCharge {
  id: string;
  name: string;
  date: string | null;
  start: string | null;
  end: string | null;
  providerName: string | null;
  quantity: number;
  net: number;
  tax: number;
  tip: number;
  status: string;
  parentId: string | null;
}

/** One booked spa session on the day sheet. */
export interface SpaSession {
  id: string;
  bookingId: string;
  personId: string | null;
  guestName: string;
  treatment: string;
  minutes: number;
  addons: string[];
  start: string;
  end: string;
  roomId: string | null;
  therapistId: string | null;
  therapistName: string | null;
}

export interface TherapistShift {
  id: string;
  personId: string;
  start: string;
  end: string;
}

export interface SpaDay {
  date: string;
  note: string;
  sessions: SpaSession[];
  shifts: TherapistShift[];
}
