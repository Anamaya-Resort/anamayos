import { createServiceClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  DEFAULT_BRANDING, COLOR_KEY_TO_CSS_VAR,
  type OrgBranding, type BrandingColors,
} from '@/config/branding-defaults';

function merge(overrides: Partial<OrgBranding>): OrgBranding {
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
}

/**
 * Fetch the org's branding for SSR injection.
 * If this admin is in test mode (cookie set + test_branding exists), returns test branding.
 * Otherwise returns live branding.
 */
export async function getOrgBranding(): Promise<{ branding: OrgBranding; hasOverrides: boolean }> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('org_branding')
      .select('branding, test_branding')
      .eq('org_slug', 'default')
      .single();

    if (!data) return { branding: DEFAULT_BRANDING, hasOverrides: false };

    // Check if this admin is in test mode
    const cookieStore = await cookies();
    const isTestMode = cookieStore.get('ao_test_branding')?.value === '1';

    if (isTestMode && data.test_branding) {
      const testOverrides = data.test_branding as Partial<OrgBranding>;
      return { branding: merge(testOverrides), hasOverrides: Object.keys(testOverrides).length > 0 };
    }

    const liveOverrides = (data.branding ?? {}) as Partial<OrgBranding>;
    return { branding: merge(liveOverrides), hasOverrides: Object.keys(liveOverrides).length > 0 };
  } catch {
    return { branding: DEFAULT_BRANDING, hasOverrides: false };
  }
}

/**
 * Convert branding colors to a CSS variable map for a given mode.
 */
export function brandingToCssVars(branding: OrgBranding, mode: 'light' | 'dark'): Record<string, string> {
  const colors = mode === 'light' ? branding.light : branding.dark;
  const vars: Record<string, string> = {};

  for (const [key, cssVar] of Object.entries(COLOR_KEY_TO_CSS_VAR)) {
    const value = colors[key as keyof BrandingColors];
    if (value) vars[cssVar] = value;
  }

  if (mode === 'light') {
    if (branding.radius !== undefined) vars['--radius'] = `${branding.radius}px`;
    if (branding.btnFxStrength !== undefined) vars['--btn-fx-strength'] = String(branding.btnFxStrength);
    if (branding.btnFxSpeed !== undefined) vars['--btn-fx-speed'] = String(branding.btnFxSpeed);
  }

  return vars;
}

/**
 * Generate an inline <style> string for CSS variable overrides.
 */
export function brandingToStyleTag(branding: OrgBranding): string {
  const lightVars = brandingToCssVars(branding, 'light');
  const darkVars = brandingToCssVars(branding, 'dark');

  const lightCss = Object.entries(lightVars).map(([k, v]) => `${k}:${v}`).join(';');
  const darkCss = Object.entries(darkVars).map(([k, v]) => `${k}:${v}`).join(';');

  if (!lightCss && !darkCss) return '';
  return `:root{${lightCss}}.dark{${darkCss}}`;
}
