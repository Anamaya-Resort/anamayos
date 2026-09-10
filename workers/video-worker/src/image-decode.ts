/**
 * Decode the formats sharp cannot open by itself.
 *
 * This build of libvips has no BMP support (sharp.format.bmp is absent
 * and magick is not compiled in), so a .bmp reached the resizer and
 * died with "unsupported image format". BMP is a simple enough format
 * that a decoder plus a raw handoff to sharp is the whole fix.
 *
 * TIFF needs nothing: sharp reads and writes it natively. It was in
 * the skip list by my mistake, alongside the raw camera formats that
 * genuinely cannot be read.
 */
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const bmp = require('bmp-js') as {
  decode: (b: Buffer) => { width: number; height: number; data: Buffer };
};

/** Formats needing a decode pass before sharp will touch them. */
export function needsPreDecode(mime: string): boolean {
  return mime === 'image/bmp' || mime === 'image/x-ms-bmp';
}

/**
 * A sharp instance for any supported input, pre-decoding where needed.
 *
 * bmp-js hands back ABGR; sharp's raw input wants RGBA, so the
 * channels are reordered in place before the handoff.
 */
export function openImage(buf: Buffer, mime: string): sharp.Sharp {
  if (!needsPreDecode(mime)) return sharp(buf);

  const img = bmp.decode(buf);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i];
    const b = px[i + 1];
    const g = px[i + 2];
    const r = px[i + 3];
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  }
  return sharp(px, {
    raw: { width: img.width, height: img.height, channels: 4 },
  });
}
