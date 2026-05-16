/**
 * Authorization for the Video Maker module.
 *
 * Two scoped roles, plus normal org admins/owners/superadmins:
 *  - visuals_manager  → admin-type powers in the visuals section
 *  - visuals_creative → project work only (matters in later slices
 *    once campaigns/timelines exist; no admin powers)
 *
 * Works with both the server session and the client useAuth() shape.
 */
import { ACCESS_LEVELS } from '@/types';

export type VisualsAuth = { accessLevel: number; roleSlugs: string[] };

export const VISUALS_MANAGER_ROLES = ['visuals_manager'];
export const VISUALS_CREATIVE_ROLES = ['visuals_creative'];
export const VISUALS_NAV_ROLES = [
  ...VISUALS_MANAGER_ROLES,
  ...VISUALS_CREATIVE_ROLES,
];

/** Admin-type access to the visuals section (connect Drives, manage sources/models). */
export function canManageVisuals(a: VisualsAuth): boolean {
  if (a.accessLevel >= ACCESS_LEVELS.admin) return true;
  return a.roleSlugs.some((r) => VISUALS_MANAGER_ROLES.includes(r));
}

/** Can do project work in the visuals section (managers can too). */
export function canUseVisuals(a: VisualsAuth): boolean {
  if (canManageVisuals(a)) return true;
  return a.roleSlugs.some((r) => VISUALS_CREATIVE_ROLES.includes(r));
}
