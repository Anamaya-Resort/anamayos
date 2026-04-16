import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'room-images';

/**
 * POST /api/admin/upload — Upload one or more images to Supabase Storage
 * Accepts multipart/form-data with 'files' field (multiple files)
 * Optional 'roomId' field to namespace uploads
 * Returns array of { url, fileName, originalName }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const roomId = formData.get('roomId') as string | null;
  const files = formData.getAll('files') as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const results: { url: string; fileName: string; originalName: string }[] = [];
  const errors: string[] = [];

  for (const file of files) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      errors.push(`${file.name}: not an image`);
      continue;
    }

    // Generate a unique path: room-images/{roomId}/{timestamp}-{sanitized-name}
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const path = roomId
      ? `${roomId}/${timestamp}-${sanitized}`
      : `general/${timestamp}-${sanitized}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      errors.push(`${file.name}: ${error.message}`);
      continue;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    results.push({
      url: urlData.publicUrl,
      fileName: sanitized,
      originalName: file.name,
    });
  }

  return NextResponse.json({
    uploaded: results,
    errors: errors.length > 0 ? errors : undefined,
  });
}
