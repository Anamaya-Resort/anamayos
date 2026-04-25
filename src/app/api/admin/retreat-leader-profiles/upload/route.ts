import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'retreat-leader-profiles';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png', 'image/gif']);

/**
 * POST /api/admin/retreat-leader-profiles/upload
 * Upload a retreat leader profile image. Multipart form: file + personId + slot (photo|banner).
 * Returns { url }.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const personId = formData.get('personId') as string | null;
  const slot = formData.get('slot') as string | null;

  if (!file || !personId || !slot) {
    return Response.json({ error: 'Missing file, personId, or slot' }, { status: 400 });
  }

  // Non-admins can only upload for their own profile
  if (session.accessLevel < 5 && session.personId !== personId) {
    return Response.json({ error: 'Cannot upload for other users' }, { status: 403 });
  }

  if (!ACCEPTED_TYPES.has(file.type)) {
    return Response.json({ error: 'Accepted types: webp, jpg, png, gif' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${personId}/${slot}-${Date.now()}.${ext}`;

  const supabase = createServiceClient();
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return Response.json({ url: urlData.publicUrl });
}
