import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';

/**
 * GET /api/auth/session
 * Returns the current session user, or null if not authenticated.
 * Used by the client-side AuthProvider to hydrate state.
 */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}
