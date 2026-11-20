import { DESK_CONFIG } from './config';
import { overlaps, toMinutes } from './time';
import type { SpaSession } from './types';

export type ConflictCode = 'provider_busy' | 'guest_busy' | 'room_busy';

/**
 * Would a session [start, end) clash with the day's bookings? Rooms and
 * therapists need the buffer between sessions; a guest just can't overlap.
 * Returns the first problem, or null if it fits.
 */
export function findConflict(
  sessions: SpaSession[],
  want: { start: number; end: number; therapistId: string | null; roomId: string | null; personId: string | null; ignoreId?: string },
): ConflictCode | null {
  const gap = DESK_CONFIG.bufferMinutes;
  for (const s of sessions) {
    if (s.id === want.ignoreId) continue;
    const a = toMinutes(s.start);
    const b = toMinutes(s.end);
    if (want.personId && s.personId === want.personId && overlaps(want.start, want.end, a, b)) return 'guest_busy';
    const near = overlaps(want.start, want.end + gap, a, b + gap);
    if (near && want.therapistId && s.therapistId === want.therapistId) return 'provider_busy';
    if (near && want.roomId && s.roomId === want.roomId) return 'room_busy';
  }
  return null;
}

/** First room free for that time, keeping the sheet's left-to-right order. */
export function freeRoom(sessions: SpaSession[], roomIds: string[], start: number, end: number): string | null {
  return roomIds.find((roomId) => !findConflict(sessions, { start, end, roomId, therapistId: null, personId: null })) ?? null;
}
