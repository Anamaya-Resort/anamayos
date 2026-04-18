/**
 * Thumbnail generation — exports a room layout as a data URL image.
 * Shows ONLY: room shapes (walls), bed rectangles + pillows, furniture shapes.
 * Hides: ALL text, arrows, openings, split king connectors, labels, titles, info.
 */

import type Konva from 'konva';
import { BED_PRESETS, BASE_SCALE, type LayoutShape, type LayoutBedPlacement, type LayoutFurniture, type LayoutWall } from './types';

interface ThumbnailParams {
  stage: Konva.Stage;
  shapes: LayoutShape[];
  bedPlacements: LayoutBedPlacement[];
  beds: Array<{ id: string; bedType: string }>;
  furniture: LayoutFurniture[];
  walls: LayoutWall[];
  zoom: number;
  pan: { x: number; y: number };
}

type KonvaNode = { visible: { (): boolean; (v: boolean): void }; getClassName?: () => string };

/** Generate a thumbnail data URL from the Konva stage.
 *  Returns null if there's nothing to export. */
export function generateThumbnailDataUrl(params: ThumbnailParams): string | null {
  const { stage, shapes, bedPlacements, beds, furniture, walls, zoom, pan } = params;
  // IMPORTANT: Layer indices are coupled to builder-canvas.tsx rendering order:
  // [0]=bg, [1]=shapes, [2]=beds+splitKing, [3]=labels, [4]=furniture, [5]=walls, [6]=openings+arrows, [7]=titles, [8]=info
  // If layers are added/removed/reordered in builder-canvas, update these indices.
  const layers = stage.children;
  if (!layers || layers.length < 8) return null;

  // Save visibility, then hide non-essential layers
  // Keep: [1]=shapes, [2]=beds (no text), [4]=furniture (no text), [5]=walls
  const savedVisibility = layers.map((l: { visible: () => boolean }) => l.visible());
  layers[0].visible(false);  // bg
  layers[3].visible(false);  // labels
  layers[6].visible(false);  // openings+arrows
  layers[7].visible(false);  // titles
  if (layers[8]) layers[8].visible(false);  // info

  // In beds layer [2] and furniture layer [4], hide ALL non-shape nodes:
  // Text (bed names, furniture labels, split king text)
  // Line (rotation handles, split king arrows, connector lines)
  // Circle (split king buttons, arc handles)
  // Only keep: Rect (bed frames, pillows, furniture) and Group containers
  const hiddenNodes: KonvaNode[] = [];
  const HIDE_TYPES = new Set(['Text', 'Line', 'Circle']);

  for (const layer of [layers[2], layers[4]]) {
    if (!layer) continue;
    for (const typeName of HIDE_TYPES) {
      layer.find?.(typeName)?.forEach?.((node: KonvaNode) => {
        if (node.visible()) {
          hiddenNodes.push(node);
          node.visible(false);
        }
      });
    }
  }

  // Compute content bounds
  const allItems: { x: number; y: number; r: number; b: number }[] = [];
  for (const s of shapes) allItems.push({ x: s.x, y: s.y, r: s.x + s.width, b: s.y + s.depth });
  for (const bp of bedPlacements) {
    const bed = beds.find((b) => b.id === bp.bedId);
    const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
    if (preset) allItems.push({ x: bp.x, y: bp.y, r: bp.x + preset.width, b: bp.y + preset.length });
  }
  for (const f of furniture) allItems.push({ x: f.x, y: f.y, r: f.x + f.width, b: f.y + f.depth });
  for (const w of walls) allItems.push({ x: Math.min(w.x1, w.x2), y: Math.min(w.y1, w.y2), r: Math.max(w.x1, w.x2), b: Math.max(w.y1, w.y2) });

  if (allItems.length === 0) {
    layers.forEach((l: { visible: (v: boolean) => void }, i: number) => l.visible(savedVisibility[i]));
    return null;
  }

  const minX = Math.min(...allItems.map((i) => i.x)) - 0.2;
  const minY = Math.min(...allItems.map((i) => i.y)) - 0.2;
  const maxX = Math.max(...allItems.map((i) => i.r)) + 0.2;
  const maxY = Math.max(...allItems.map((i) => i.b)) + 0.2;
  const sc = BASE_SCALE * zoom;
  const exportOpts = {
    x: minX * sc + pan.x,
    y: minY * sc + pan.y,
    width: (maxX - minX) * sc,
    height: (maxY - minY) * sc,
    pixelRatio: 0.5,
  };

  const webpUrl = stage.toDataURL({ ...exportOpts, mimeType: 'image/webp', quality: 0.8 });
  const dataUrl = webpUrl.startsWith('data:image/webp')
    ? webpUrl
    : stage.toDataURL({ ...exportOpts, mimeType: 'image/png', quality: 0.8 });

  // Restore
  layers.forEach((l: { visible: (v: boolean) => void }, i: number) => l.visible(savedVisibility[i]));
  hiddenNodes.forEach((node) => node.visible(true));

  return dataUrl;
}
