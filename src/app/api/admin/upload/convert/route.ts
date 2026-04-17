import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import sharp from 'sharp';

const BUCKET = 'room-images';

/**
 * POST /api/admin/upload/convert — Convert an image URL to WebP
 * Fetches the image, converts via sharp, uploads to storage, returns new URL
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { url: string; roomId: string; fileName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    // Fetch the original image
    const imgRes = await fetch(body.url);
    if (!imgRes.ok) {
      return NextResponse.json({ error: `Failed to fetch image: ${imgRes.status}` }, { status: 400 });
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer());

    // Convert to WebP
    const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

    const baseName = (body.fileName ?? body.url.split('/').pop() ?? 'image')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = body.roomId
      ? `${body.roomId}/${Date.now()}-${baseName}.webp`
      : `general/${Date.now()}-${baseName}.webp`;

    const supabase = createServiceClient();

    // Try upload — if bucket doesn't exist, create it and retry
    let uploadError = null;
    const doUpload = async () => {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, webpBuffer, { contentType: 'image/webp', upsert: false });
      return error;
    };

    uploadError = await doUpload();

    if (uploadError?.message?.includes('not found') || uploadError?.message?.includes('does not exist')) {
      // Try to create the bucket
      await supabase.storage.createBucket(BUCKET, { public: true });
      uploadError = await doUpload();
    }

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      url: urlData.publicUrl,
      fileName: `${baseName}.webp`,
      originalSize: buffer.length,
      webpSize: webpBuffer.length,
      savings: Math.round((1 - webpBuffer.length / buffer.length) * 100),
    });
  } catch (err) {
    console.error('[Convert Error]', err);
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }
}
