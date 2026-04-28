import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import sharp from 'sharp';

const BUCKET = 'general-media';
const MAX_WIDTH = 1200;

/**
 * POST /api/admin/products/upload
 * Uploads an image, resizes to max 1200px width, converts to webp.
 * Multipart: file + context (e.g., 'category' or 'product') + id
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const context = (formData.get('context') as string) ?? 'product';
  const contextId = (formData.get('id') as string) ?? 'general';

  if (!file) return Response.json({ error: 'Missing file' }, { status: 400 });
  if (!file.type.startsWith('image/')) return Response.json({ error: 'Must be an image' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: 'Max 20MB' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Resize to max 1200px width and convert to webp
  const webpBuffer = await sharp(buffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `products/${context}/${contextId}/${Date.now()}-${baseName}.webp`;

  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, webpBuffer, { contentType: 'image/webp', upsert: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return Response.json({ url: urlData.publicUrl });
}
