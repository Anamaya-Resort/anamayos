import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

const VALID_SLOTS = ['portrait', 'icon', 'feature', 'banner'] as const;
const BUCKET = 'org-logos';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = new Set([
  'image/webp', 'image/jpeg', 'image/png', 'image/gif',
  'video/webm', 'video/mp4',
]);

/**
 * GET /api/admin/organizations/[id]/logos
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id: orgId } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase.from('org_logos').select('*').eq('org_id', orgId).order('slot');
  return Response.json({ logos: data ?? [] });
}

/**
 * POST /api/admin/organizations/[id]/logos
 * Upload a logo to a slot. Multipart form: file + slot field.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id: orgId } = await params;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const slot = formData.get('slot') as string | null;

  if (!file || !slot) return Response.json({ error: 'Missing file or slot' }, { status: 400 });
  if (!VALID_SLOTS.includes(slot as typeof VALID_SLOTS[number])) {
    return Response.json({ error: `Invalid slot. Must be one of: ${VALID_SLOTS.join(', ')}` }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return Response.json({ error: 'Unsupported file type. Accepted: webp, jpg, png, gif, webm, mp4' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `${orgId}/${slot}.${ext}`;

  // Ensure bucket exists
  const { error: bucketErr } = await supabase.storage.getBucket(BUCKET);
  if (bucketErr) {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE });
  }

  // Upload (overwrite existing)
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadErr) return Response.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  // Upsert DB record
  const { data: logo, error: dbErr } = await supabase.from('org_logos').upsert({
    org_id: orgId, slot, url: publicUrl, file_name: file.name,
    file_size: file.size, mime_type: file.type,
  }, { onConflict: 'org_id,slot' }).select('*').single();

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 });
  return Response.json({ logo }, { status: 201 });
}

/**
 * DELETE /api/admin/organizations/[id]/logos?slot=portrait
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id: orgId } = await params;
  const url = new URL(request.url);
  const slot = url.searchParams.get('slot');
  if (!slot) return Response.json({ error: 'Missing slot param' }, { status: 400 });

  const supabase = createServiceClient();

  // Delete from storage (try common extensions)
  for (const ext of ['webp', 'jpg', 'png', 'gif', 'webm', 'mp4']) {
    await supabase.storage.from(BUCKET).remove([`${orgId}/${slot}.${ext}`]);
  }

  // Delete DB record
  await supabase.from('org_logos').delete().eq('org_id', orgId).eq('slot', slot);
  return Response.json({ ok: true });
}
