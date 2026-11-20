import type { TranslationKeys } from '@/i18n/en';

export type DeskLabels = TranslationKeys['experience']['desk'];

const ERR: Record<string, keyof DeskLabels> = {
  provider_busy: 'errProviderBusy',
  guest_busy: 'errGuestBusy',
  room_busy: 'errRoomBusy',
  outside_hours: 'errOutsideHours',
  not_offered: 'errNotOffered',
  not_found: 'errNotFound',
};

export const errorText = (l: DeskLabels, code?: string) => l[ERR[code ?? ''] ?? 'errGeneric'];
