import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { DEFAULT_BRANDING, type OrgBranding } from '@/config/branding-defaults';

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();

const brandingColorsSchema = z.object({
  brand: hexColorSchema,
  brandSubtle: hexColorSchema,
  brandBtn: hexColorSchema,
  brandBtnHover: hexColorSchema,
  brandBtnText: hexColorSchema,
  brandHighlight: hexColorSchema,
  brandDivider: hexColorSchema,
  brandMuted: hexColorSchema,
  destructive: hexColorSchema,
  success: hexColorSchema,
  warning: hexColorSchema,
  info: hexColorSchema,
}).partial();

const brandingSchema = z.object({
  light: brandingColorsSchema.optional(),
  dark: brandingColorsSchema.optional(),
  fontHeading: z.string().max(100).optional(),
  fontBody: z.string().max(100).optional(),
  radius: z.number().min(0).max(20).optional(),
  btnFxStrength: z.number().min(0).max(1).optional(),
  btnFxSpeed: z.number().min(0.5).max(2).optional(),
  btnFxSoundEnabled: z.boolean().optional(),
  backgroundImageUrl: z.string().url().or(z.literal('')).optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
});

function deepMerge(defaults: OrgBranding, overrides: Partial<OrgBranding>): OrgBranding {
  return {
    light: { ...defaults.light, ...overrides.light },
    dark: { ...defaults.dark, ...overrides.dark },
    fontHeading: overrides.fontHeading ?? defaults.fontHeading,
    fontBody: overrides.fontBody ?? defaults.fontBody,
    radius: overrides.radius ?? defaults.radius,
    btnFxStrength: overrides.btnFxStrength ?? defaults.btnFxStrength,
    btnFxSpeed: overrides.btnFxSpeed ?? defaults.btnFxSpeed,
    btnFxSoundEnabled: overrides.btnFxSoundEnabled ?? defaults.btnFxSoundEnabled,
    backgroundImageUrl: overrides.backgroundImageUrl ?? defaults.backgroundImageUrl,
    backgroundOpacity: overrides.backgroundOpacity ?? defaults.backgroundOpacity,
  };
}

/**
 * GET /api/admin/branding
 * Returns merged branding (DB overrides + defaults).
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('org_branding')
    .select('branding')
    .eq('org_slug', 'default')
    .single();

  const overrides = (data?.branding ?? {}) as Partial<OrgBranding>;
  const merged = deepMerge(DEFAULT_BRANDING, overrides);

  return Response.json({ branding: merged, overrides });
}

/**
 * PUT /api/admin/branding
 * Upserts branding overrides. Only stores non-default values.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Read existing overrides and merge with new values
  const { data: existing } = await supabase
    .from('org_branding')
    .select('branding')
    .eq('org_slug', 'default')
    .single();

  const existingOverrides = (existing?.branding ?? {}) as Partial<OrgBranding>;

  // Merge strategy:
  // - light/dark: if provided with keys, merge into existing. If empty {}, clear all color overrides.
  // - Other keys: incoming values override existing.
  const incomingLight = parsed.data.light;
  const incomingDark = parsed.data.dark;

  const newOverrides: Partial<OrgBranding> = {
    ...existingOverrides,
    ...parsed.data,
  };

  if (incomingLight !== undefined) {
    newOverrides.light = Object.keys(incomingLight).length > 0
      ? { ...existingOverrides.light, ...incomingLight }
      : {}; // Empty = clear all color overrides
  }
  if (incomingDark !== undefined) {
    newOverrides.dark = Object.keys(incomingDark).length > 0
      ? { ...existingOverrides.dark, ...incomingDark }
      : {};
  }

  const { error } = await supabase
    .from('org_branding')
    .upsert(
      { org_slug: 'default', branding: newOverrides },
      { onConflict: 'org_slug' },
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const merged = deepMerge(DEFAULT_BRANDING, newOverrides);
  return Response.json({ branding: merged });
}
