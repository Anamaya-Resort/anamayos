import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';

/**
 * Returns the org_id for the active session's user.
 * For now picks the first org the user is a member of.
 * When per-user multi-org becomes a real workflow, add a session-stored
 * `activeOrgId` or a URL `?org=` param, then prefer those.
 */
export async function getActiveOrgId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.personId) return null;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('person_id', session.personId)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}
