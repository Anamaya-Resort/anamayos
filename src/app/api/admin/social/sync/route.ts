import { getSession } from '@/lib/session';
import { syncInstagram } from '@/modules/social/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/social/sync
 *
 * Runs the Instagram pull by hand, for the first backfill and for
 * checking a freshly saved token without waiting for the night.
 *
 * `windowDays` says how far back to look for posts. The default is
 * deliberately short for the nightly run; a first backfill wants a
 * larger number, bearing in mind that only today's figures can ever be
 * recorded for an old post. Backfilling reaches the posts, their
 * captions and their pillars, never the days that have already passed.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { windowDays?: number; maxPosts?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // An empty body is fine and means "use the defaults".
  }

  const windowDays = clamp(body.windowDays, 1, 3650);
  const maxPosts = clamp(body.maxPosts, 1, 2000);

  try {
    const result = await syncInstagram({ windowDays, maxPosts });
    if (!result.connected) {
      return Response.json(
        { ...result, message: 'No Instagram token is saved yet.' },
        { status: 409 },
      );
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}

function clamp(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, Math.round(value)));
}
