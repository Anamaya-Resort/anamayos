import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createSource, listSources } from '@/modules/video/sources/queries';

const createSchema = z
  .object({
    connectionId: z.string().uuid(),
    label: z.string().min(1).max(200),
    driveFolderId: z.string().min(1).max(200),
    driveKind: z.enum(['my_drive_folder', 'shared_drive_folder', 'shared_drive_root']),
    driveId: z.string().max(200).nullable().optional(),
  })
  .strict();

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });
  return NextResponse.json({ sources: await listSources(orgId) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', detail: parsed.error.issues }, { status: 400 });
  }

  try {
    const id = await createSource({
      orgId,
      connectionId: parsed.data.connectionId,
      label: parsed.data.label,
      driveKind: parsed.data.driveKind,
      driveFolderId: parsed.data.driveFolderId,
      driveId: parsed.data.driveId ?? null,
    });
    return NextResponse.json({ id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
