/**
 * Reception Desk settings. One place to change spa hours, slot size,
 * tip presets and which product categories each desk tile shows.
 */
export const DESK_CONFIG = {
  /** Property clock: "today", in-house guests and price dates use this. */
  timezone: 'America/Costa_Rica',
  /** Spa booking window (24h "HH:MM") and slot size in minutes. */
  spaOpen: '08:00',
  spaClose: '20:30',
  slotMinutes: 15,
  /** "Please allow 30 minutes between sessions" (same room or therapist). */
  bufferMinutes: 30,
  /** Day sheet: height of one 15-minute row, in rem. */
  sheetRowRem: 1.75,
  /** Tip buttons, as % of the item price. */
  tipPresets: [10, 15, 20] as const,
  /** Booking statuses that count as "staying with us". */
  inHouseStatuses: ['confirmed', 'deposit_paid', 'paid_in_full', 'checked_in'] as const,
  /** Desk tiles that sell catalog products, by top-level category slug. */
  shopTiles: {
    excursions: ['excursions'],
    shop: ['retail', 'gifts'],
    snacks: ['food-beverage'],
    transport: ['transfers'],
  },
} as const;

export type ShopTile = keyof typeof DESK_CONFIG.shopTiles;
export type DeskTile = 'spa' | ShopTile;
