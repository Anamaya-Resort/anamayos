/**
 * Booking availability logic — determines which beds are free for a date range.
 * Used by the availability API and the booking wizard's room filtering.
 */

export interface AvailableBed {
  bedId: string;
  label: string;
  bedType: string;
  capacity: number;
  splitKingPairBedId: string | null;
}

export interface OccupiedBed {
  bedId: string;
  guestName?: string;
}

export interface RoomAvailability {
  roomId: string;
  roomName: string;
  isShared: boolean;
  maxOccupancy: number;
  totalBeds: number;
  availableBeds: AvailableBed[];
  occupiedBeds: OccupiedBed[];
  isFullyBooked: boolean;
}

export type GuestType = 'solo' | 'couple_shared' | 'couple_separate';

export interface FilteredRoom extends RoomAvailability {
  matchQuality: 'perfect' | 'fallback';
  needsApproval: boolean;
  suggestedBeds: string[]; // bedIds that match the guest type
}

/**
 * Filter rooms based on guest type and bed preferences.
 */
export function filterRoomsForGuest(
  rooms: RoomAvailability[],
  guestType: GuestType,
): FilteredRoom[] {
  const results: FilteredRoom[] = [];

  for (const room of rooms) {
    if (room.isFullyBooked) continue;
    const avail = room.availableBeds;

    if (guestType === 'solo') {
      // Any room with at least 1 available bed
      if (avail.length > 0) {
        results.push({
          ...room,
          matchQuality: 'perfect',
          needsApproval: false,
          suggestedBeds: [avail[0].bedId],
        });
      }
    } else if (guestType === 'couple_shared') {
      // Priority 1: Queen bed available
      const queen = avail.find((b) => b.bedType === 'queen' || b.bedType === 'king');
      if (queen) {
        results.push({
          ...room,
          matchQuality: 'perfect',
          needsApproval: false,
          suggestedBeds: [queen.bedId],
        });
        continue;
      }

      // Priority 1 (equal): Split king pair — both beds in the pair must be available
      const availIds = new Set(avail.map((b) => b.bedId));
      const splitPair = avail.find((b) =>
        b.splitKingPairBedId && availIds.has(b.splitKingPairBedId),
      );
      if (splitPair && splitPair.splitKingPairBedId) {
        results.push({
          ...room,
          matchQuality: 'perfect',
          needsApproval: false,
          suggestedBeds: [splitPair.bedId, splitPair.splitKingPairBedId],
        });
        continue;
      }

      // Fallback: Triple room with 2+ available beds (needs approval)
      if (avail.length >= 2 && room.maxOccupancy >= 3) {
        results.push({
          ...room,
          matchQuality: 'fallback',
          needsApproval: true,
          suggestedBeds: avail.slice(0, 2).map((b) => b.bedId),
        });
      }
    } else if (guestType === 'couple_separate') {
      // Need 2+ available single/single_long beds
      const singles = avail.filter((b) =>
        b.bedType === 'single' || b.bedType === 'single_long',
      );
      if (singles.length >= 2) {
        results.push({
          ...room,
          matchQuality: 'perfect',
          needsApproval: false,
          suggestedBeds: singles.slice(0, 2).map((b) => b.bedId),
        });
        continue;
      }

      // Fallback: Triple room with 2+ available beds
      if (avail.length >= 2 && room.maxOccupancy >= 3) {
        results.push({
          ...room,
          matchQuality: 'fallback',
          needsApproval: true,
          suggestedBeds: avail.slice(0, 2).map((b) => b.bedId),
        });
      }
    }
  }

  // Sort: perfect matches first, then fallbacks
  results.sort((a, b) => {
    if (a.matchQuality === 'perfect' && b.matchQuality !== 'perfect') return -1;
    if (a.matchQuality !== 'perfect' && b.matchQuality === 'perfect') return 1;
    return 0;
  });

  return results;
}
