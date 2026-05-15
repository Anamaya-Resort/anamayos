import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}
