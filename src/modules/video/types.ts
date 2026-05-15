/**
 * Video Maker — shared types.
 * The Timeline type below is the load-bearing contract for the whole feature.
 * Conversational editing applies RFC 6902 JSON Patches that address `node_id`s,
 * never array indices. Treat any change to this file as a schema migration.
 */

export type PlatformVariantId = string;

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export type Transition = {
  kind: 'cut' | 'fade' | 'dissolve' | 'wipe';
  duration_ms: number;
};

export type VideoClip = {
  node_id: string;
  asset_id: string;
  in_ms: number;
  out_ms: number;
  start_ms: number;
  transform?: { crop?: Rect; zoom?: number; pan?: { from: Point; to: Point } };
  transition_in?: Transition;
  transition_out?: Transition;
};

export type AudioClip = {
  node_id: string;
  source:
    | { kind: 'music'; track_id: string }
    | { kind: 'voiceover'; tts_audio_path: string }
    | { kind: 'asset_audio'; asset_id: string };
  start_ms: number;
  duration_ms: number;
  gain_db: number;
};

export type CaptionBlock = {
  node_id: string;
  text: string;
  start_ms: number;
  duration_ms: number;
  style_ref: string;
};

export type OverlayBlock = {
  node_id: string;
  kind: 'logo' | 'lower_third' | 'cta' | 'safe_zone_marker';
  source_path: string;
  start_ms: number;
  duration_ms: number;
  position: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
};

export type Timeline = {
  id: string;
  version: number;
  parent_version: number | null;
  output: {
    aspect: '9:16' | '1:1' | '16:9';
    fps: 24 | 30 | 60;
    platform_variant_id: PlatformVariantId;
  };
  duration_ms: number;
  tracks: {
    video: VideoClip[];
    audio: AudioClip[];
    captions: CaptionBlock[];
    overlays: OverlayBlock[];
  };
  brand: { guide_id: string; archetype_id: string | null };
};

export type VideoUsePermission =
  | 'unknown'
  | 'do_not_use'
  | 'internal_only'
  | 'organic_social_ok'
  | 'ads_ok'
  | 'public_marketing_ok';

export type RenderIntentDestination =
  | 'internal'
  | 'organic_social'
  | 'ads'
  | 'public_marketing';

export type ModelRole =
  | 'vision'
  | 'transcript'
  | 'embed'
  | 'script'
  | 'edit'
  | 'caption';
