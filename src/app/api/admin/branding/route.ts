import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { DEFAULT_BRANDING, type OrgBranding } from '@/config/branding-defaults';
import { cookies } from 'next/headers';

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();

const brandingColorsSchema = z.object({
  brand: hexColorSchema, brandSubtle: hexColorSchema, brandBtn: hexColorSchema,
  brandBtnHover: hexColorSchema, brandBtnText: hexColorSchema, brandHighlight: hexColorSchema,
  brandDivider: hexColorSchema, brandMuted: hexColorSchema,
  destructive: hexColorSchema, success: hexColorSchema, warning: hexColorSchema, info: hexColorSchema,
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
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColorDark: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundImageUrl: z.string().url().or(z.literal('')).optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  backgroundBlendMode: z.enum(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']).optional(),
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
    backgroundColor: overrides.backgroundColor ?? defaults.backgroundColor,
    backgroundColorDark: overrides.backgroundColorDark ?? defaults.backgroundColorDark,
    backgroundImageUrl: overrides.backgroundImageUrl ?? defaults.backgroundImageUrl,
    backgroundOpacity: overrides.backgroundOpacity ?? defaults.backgroundOpacity,
    backgroundBlendMode: overrides.backgroundBlendMode ?? defaults.backgroundBlendMode,
  };
}

/**
 * GET /api/admin/branding
 * Returns merged live branding + test branding (if exists).
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('org_branding')
    .select('branding, test_branding')
    .eq('org_slug', 'default')
    .single();

  const liveOverrides = (data?.branding ?? {}) as Partial<OrgBranding>;
  const testOverrides = data?.test_branding as Partial<OrgBranding> | null;

  const branding = deepMerge(DEFAULT_BRANDING, liveOverrides);
  const testBranding = testOverrides ? deepMerge(DEFAULT_BRANDING, testOverrides) : null;

  // Check if this admin has test mode cookie
  const cookieStore = await cookies();
  const isTestMode = cookieStore.get('ao_test_branding')?.value === '1' && testBranding !== null;

  return Response.json({ branding, testBranding, isTestMode });
}

/**
 * PUT /api/admin/branding?target=live|test|promote|discard
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get('target') ?? 'live';

  const supabase = createServiceClient();

  // ── Promote: copy test → live, clear test ──
  if (target === 'promote') {
    const { data: row } = await supabase
      .from('org_branding').select('test_branding').eq('org_slug', 'default').single();
    if (!row?.test_branding) {
      return Response.json({ error: 'No test branding to promote' }, { status: 400 });
    }
    await supabase.from('org_branding').update({
      branding: row.test_branding,
      test_branding: null,
    }).eq('org_slug', 'default');

    // Clear test mode cookie
    const cookieStore = await cookies();
    cookieStore.delete('ao_test_branding');

    const merged = deepMerge(DEFAULT_BRANDING, row.test_branding as Partial<OrgBranding>);
    return Response.json({ branding: merged, testBranding: null, isTestMode: false });
  }

  // ── Discard: clear test branding ──
  if (target === 'discard') {
    await supabase.from('org_branding').update({ test_branding: null }).eq('org_slug', 'default');

    const cookieStore = await cookies();
    cookieStore.delete('ao_test_branding');

    const { data } = await supabase.from('org_branding').select('branding').eq('org_slug', 'default').single();
    const merged = deepMerge(DEFAULT_BRANDING, (data?.branding ?? {}) as Partial<OrgBranding>);
    return Response.json({ branding: merged, testBranding: null, isTestMode: false });
  }

  // ── Save to live or test ──
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  const column = target === 'test' ? 'test_branding' : 'branding';

  const { data: existing } = await supabase
    .from('org_branding').select(column).eq('org_slug', 'default').single();

  const existingOverrides = ((existing as Record<string, unknown>)?.[column] ?? {}) as Partial<OrgBranding>;

  const newOverrides: Partial<OrgBranding> = { ...existingOverrides, ...parsed.data };
  const incomingLight = parsed.data.light;
  const incomingDark = parsed.data.dark;
  if (incomingLight !== undefined) {
    newOverrides.light = Object.keys(incomingLight).length > 0
      ? { ...existingOverrides.light, ...incomingLight } : {};
  }
  if (incomingDark !== undefined) {
    newOverrides.dark = Object.keys(incomingDark).length > 0
      ? { ...existingOverrides.dark, ...incomingDark } : {};
  }

  await supabase.from('org_branding').upsert(
    { org_slug: 'default', [column]: newOverrides },
    { onConflict: 'org_slug' },
  );

  const merged = deepMerge(DEFAULT_BRANDING, newOverrides);
  return Response.json({ branding: merged });
}
