import { createServiceClient } from '@/lib/supabase/server';
import {
  DEFAULT_BRANDING, COLOR_KEY_TO_CSS_VAR,
  type OrgBranding, type BrandingColors,
} from '@/config/branding-defaults';

/**
 * Fetch the org's branding from the database, merged with defaults.
 * Call from server components only.
 */
export async function getOrgBranding(): Promise<OrgBranding> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('org_branding')
      .select('branding')
      .eq('org_slug', 'default')
      .single();

    if (!data?.branding) return DEFAULT_BRANDING;

    const overrides = data.branding as Partial<OrgBranding>;
    return {
      light: { ...DEFAULT_BRANDING.light, ...overrides.light },
      dark: { ...DEFAULT_BRANDING.dark, ...overrides.dark },
      fontHeading: overrides.fontHeading ?? DEFAULT_BRANDING.fontHeading,
      fontBody: overrides.fontBody ?? DEFAULT_BRANDING.fontBody,
      radius: overrides.radius ?? DEFAULT_BRANDING.radius,
      btnFxStrength: overrides.btnFxStrength ?? DEFAULT_BRANDING.btnFxStrength,
      btnFxSpeed: overrides.btnFxSpeed ?? DEFAULT_BRANDING.btnFxSpeed,
      btnFxSoundEnabled: overrides.btnFxSoundEnabled ?? DEFAULT_BRANDING.btnFxSoundEnabled,
      backgroundImageUrl: overrides.backgroundImageUrl ?? DEFAULT_BRANDING.backgroundImageUrl,
      backgroundOpacity: overrides.backgroundOpacity ?? DEFAULT_BRANDING.backgroundOpacity,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

/**
 * Convert branding colors to a CSS variable map for a given mode.
 * Returns entries like { '--brand-btn': '#A35B4E' }
 */
export function brandingToCssVars(branding: OrgBranding, mode: 'light' | 'dark'): Record<string, string> {
  const colors = mode === 'light' ? branding.light : branding.dark;
  const vars: Record<string, string> = {};

  for (const [key, cssVar] of Object.entries(COLOR_KEY_TO_CSS_VAR)) {
    const value = colors[key as keyof BrandingColors];
    if (value) vars[cssVar] = value;
  }

  // Non-color variables (only in light/root since they don't change per mode)
  if (mode === 'light') {
    if (branding.radius !== undefined) vars['--radius'] = `${branding.radius}px`;
    if (branding.btnFxStrength !== undefined) vars['--btn-fx-strength'] = String(branding.btnFxStrength);
    if (branding.btnFxSpeed !== undefined) vars['--btn-fx-speed'] = String(branding.btnFxSpeed);
  }

  return vars;
}

/**
 * Generate an inline <style> string for CSS variable overrides.
 * Used by the dashboard layout to inject branding at SSR time.
 */
export function brandingToStyleTag(branding: OrgBranding): string {
  const lightVars = brandingToCssVars(branding, 'light');
  const darkVars = brandingToCssVars(branding, 'dark');

  const lightCss = Object.entries(lightVars).map(([k, v]) => `${k}:${v}`).join(';');
  const darkCss = Object.entries(darkVars).map(([k, v]) => `${k}:${v}`).join(';');

  if (!lightCss && !darkCss) return '';
  return `:root{${lightCss}}.dark{${darkCss}}`;
}
