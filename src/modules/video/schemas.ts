/**
 * Zod schemas mirroring types.ts. Use these at every API boundary and
 * after every LLM structured-output call. Strict mode rejects unknown fields.
 */
import { z } from 'zod';

export const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const pointSchema = z.object({ x: z.number(), y: z.number() });

export const transitionSchema = z.object({
  kind: z.enum(['cut', 'fade', 'dissolve', 'wipe']),
  duration_ms: z.number().int().nonnegative(),
});

export const videoClipSchema = z.object({
  node_id: z.string().min(1),
  asset_id: z.string().uuid(),
  in_ms: z.number().int().nonnegative(),
  out_ms: z.number().int().nonnegative(),
  start_ms: z.number().int().nonnegative(),
  transform: z
    .object({
      crop: rectSchema.optional(),
      zoom: z.number().optional(),
      pan: z.object({ from: pointSchema, to: pointSchema }).optional(),
    })
    .optional(),
  transition_in: transitionSchema.optional(),
  transition_out: transitionSchema.optional(),
});

export const audioClipSchema = z.object({
  node_id: z.string().min(1),
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('music'), track_id: z.string().uuid() }),
    z.object({ kind: z.literal('voiceover'), tts_audio_path: z.string() }),
    z.object({ kind: z.literal('asset_audio'), asset_id: z.string().uuid() }),
  ]),
  start_ms: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative(),
  gain_db: z.number(),
});

export const captionBlockSchema = z.object({
  node_id: z.string().min(1),
  text: z.string(),
  start_ms: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative(),
  style_ref: z.string(),
});

export const overlayBlockSchema = z.object({
  node_id: z.string().min(1),
  kind: z.enum(['logo', 'lower_third', 'cta', 'safe_zone_marker']),
  source_path: z.string(),
  start_ms: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative(),
  position: z.object({
    x_pct: z.number(),
    y_pct: z.number(),
    w_pct: z.number(),
    h_pct: z.number(),
  }),
});

export const timelineSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  parent_version: z.number().int().positive().nullable(),
  output: z.object({
    aspect: z.enum(['9:16', '1:1', '16:9']),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
    platform_variant_id: z.string(),
  }),
  duration_ms: z.number().int().nonnegative(),
  tracks: z.object({
    video: z.array(videoClipSchema),
    audio: z.array(audioClipSchema),
    captions: z.array(captionBlockSchema),
    overlays: z.array(overlayBlockSchema),
  }),
  brand: z.object({
    guide_id: z.string().uuid(),
    archetype_id: z.string().uuid().nullable(),
  }),
});

export const videoUsePermissionSchema = z.enum([
  'unknown',
  'do_not_use',
  'internal_only',
  'organic_social_ok',
  'ads_ok',
  'public_marketing_ok',
]);

export const renderIntentDestinationSchema = z.enum([
  'internal',
  'organic_social',
  'ads',
  'public_marketing',
]);

export const modelRoleSchema = z.enum([
  'vision',
  'transcript',
  'embed',
  'script',
  'edit',
  'caption',
]);
