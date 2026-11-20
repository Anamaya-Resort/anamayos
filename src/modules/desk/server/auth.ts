import 'server-only';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { ACCESS_LEVELS } from '@/types';

/** Reception Desk is staff+ only. Returns the session or a 403 response. */
export async function requireDeskStaff() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < ACCESS_LEVELS.staff) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) } as const;
  }
  return { session } as const;
}
