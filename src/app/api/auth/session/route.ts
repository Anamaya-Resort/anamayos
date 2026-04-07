import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * GET /api/auth/session
 * Returns the current session data including user, personId, accessLevel, and roleSlugs.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null, personId: null, accessLevel: 0, roleSlugs: [] });
  }
  return NextResponse.json({
    user: session.user,
    personId: session.personId,
    accessLevel: session.accessLevel,
    roleSlugs: session.roleSlugs,
  });
}
