/** Room data for display and selection */
export interface RoomData {
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
  galleryImages: string[];
  features: string[];
  beds: Array<{ id: string; label: string; bedType: string }>;
}

/** Room card display mode */
export type RoomCardMode = 'display' | 'select';

/** Bed availability for date-aware selection */
export interface BedAvailability {
  bedId: string;
  isAvailable: boolean;
}
