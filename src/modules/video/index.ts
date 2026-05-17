// Video Maker module barrel.
// Sub-features land here slice-by-slice as they ship.

export type {
  Timeline,
  VideoClip,
  AudioClip,
  CaptionBlock,
  OverlayBlock,
  VideoUsePermission,
  RenderIntentDestination,
  ModelRole,
  PlatformVariantId,
  Rect,
  Point,
  Transition,
} from './types';

export {
  timelineSchema,
  videoClipSchema,
  audioClipSchema,
  captionBlockSchema,
  overlayBlockSchema,
  videoUsePermissionSchema,
  renderIntentDestinationSchema,
  modelRoleSchema,
  approvalStatusSchema,
  reviewInputSchema,
  bulkReviewSchema,
} from './schemas';

export type { ReviewInput, BulkReviewInput } from './schemas';
