/**
 * Server-side queries for google_drive_connections rows.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { encryptToken } from './crypto';

export type DriveConnection = {
  id: string;
  org_id: string;
  google_account_email: string;
  oauth_scope: string;
  status: string;
  last_token_refresh_at: string | null;
  last_error: string | null;
  added_by: string | null;
  created_at: string;
};

export async function listConnections(orgId: string): Promise<DriveConnection[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('google_drive_connections')
    .select('id, org_id, google_account_email, oauth_scope, status, last_token_refresh_at, last_error, added_by, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data ?? []) as DriveConnection[];
}

export async function upsertConnection(opts: {
  orgId: string;
  googleAccountEmail: string;
  accessToken: string;
  refreshToken: string;
  scope: string;
  addedBy: string | null;
}): Promise<string> {
  const supabase = createServiceClient();
  const row = {
    org_id: opts.orgId,
    google_account_email: opts.googleAccountEmail,
    oauth_access_enc: encryptToken(opts.accessToken),
    oauth_refresh_enc: encryptToken(opts.refreshToken),
    oauth_scope: opts.scope,
    status: 'active',
    last_token_refresh_at: new Date().toISOString(),
    added_by: opts.addedBy,
  };
  const { data, error } = await supabase
    .from('google_drive_connections')
    .upsert(row, { onConflict: 'org_id,google_account_email' })
    .select('id')
    .single();
  if (error) throw new Error(`upsert connection failed: ${error.message}`);
  return data.id;
}

export async function deleteConnection(orgId: string, id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('google_drive_connections')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw new Error(`delete connection failed: ${error.message}`);
}
