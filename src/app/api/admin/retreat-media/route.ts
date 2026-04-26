import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'retreat-media';
const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png', 'image/gif']);

/**
 * GET /api/admin/retreat-media?retreatId=uuid
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const retreatId = searchParams.get('retreatId');
  if (!retreatId) return Response.json({ error: 'Missing retreatId' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('retreat_media')
    .select('*')
    .eq('retreat_id', retreatId)
    .order('sort_order');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ media: data ?? [] });
}

/**
 * POST /api/admin/retreat-media
 * Upload an image + create a media row. Multipart: file + retreatId + purpose + caption + alt_text
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const retreatId = formData.get('retreatId') as string | null;
  const purpose = (formData.get('purpose') as string) ?? 'gallery';

  if (!file || !retreatId) {
    return Response.json({ error: 'Missing file or retreatId' }, { status: 400 });
  }

  if (!ACCEPTED_TYPES.has(file.type)) {
    return Response.json({ error: 'Accepted types: webp, jpg, png, gif' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${retreatId}/${purpose}-${Date.now()}.${ext}`;

  const supabase = createServiceClient();
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Get current max sort_order
  const { data: existing } = await supabase
    .from('retreat_media')
    .select('sort_order')
    .eq('retreat_id', retreatId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0] as Record<string, unknown>)?.sort_order as number ?? -1) + 1;

  const { data: row, error: dbError } = await supabase
    .from('retreat_media')
    .insert({
      retreat_id: retreatId,
      url: urlData.publicUrl,
      media_type: 'photo',
      purpose,
      caption: (formData.get('caption') as string) || null,
      alt_text: (formData.get('alt_text') as string) || null,
      sort_order: nextOrder,
      file_size: file.size,
    })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ media: row });
}

/**
 * PUT /api/admin/retreat-media — update caption, alt_text, sort_order
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = body.id as string;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};
  if ('caption' in body) update.caption = body.caption || null;
  if ('alt_text' in body) update.alt_text = body.alt_text || null;
  if ('sort_order' in body) update.sort_order = body.sort_order;
  if ('purpose' in body) update.purpose = body.purpose;

  const { data, error } = await supabase
    .from('retreat_media')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ media: data });
}

/**
 * DELETE /api/admin/retreat-media?id=uuid
 */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from('retreat_media').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
