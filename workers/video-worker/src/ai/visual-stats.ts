/**
 * Deterministic visual stats from the proxy image — no AI, no cost.
 * Color temperature + brightness drive slideshow lighting continuity;
 * dominant color seeds the palette. Math is more accurate and far
 * cheaper than asking an LLM "is this warm?".
 */
import sharp from 'sharp';

export type VisualStats = {
  colorTemp: 'warm' | 'neutral' | 'cool';
  brightness: number; // 0..1 perceived luma
  dominantColors: { hex: string; pct: number }[];
};

function hex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export async function computeVisualStats(buf: Buffer): Promise<VisualStats> {
  // Downscale to a tiny raw bitmap for fast mean color / luma.
  const { data, info } = await sharp(buf)
    .resize(64, 64, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let rs = 0, gs = 0, bs = 0;
  const px = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    rs += data[i];
    gs += data[i + 1];
    bs += data[i + 2];
  }
  const r = rs / px, g = gs / px, b = bs / px;
  const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  // Warm if red dominates blue, cool if blue dominates red.
  const diff = r - b;
  const colorTemp = diff > 12 ? 'warm' : diff < -12 ? 'cool' : 'neutral';

  // sharp's dominant color (most common) as the palette seed.
  let dominantColors: { hex: string; pct: number }[] = [{ hex: hex(r, g, b), pct: 1 }];
  try {
    const stats = await sharp(buf).stats();
    if (stats.dominant) {
      dominantColors = [
        { hex: hex(stats.dominant.r, stats.dominant.g, stats.dominant.b), pct: 1 },
      ];
    }
  } catch {
    // keep the mean-color fallback
  }

  return { colorTemp, brightness: Number(brightness.toFixed(4)), dominantColors };
}
