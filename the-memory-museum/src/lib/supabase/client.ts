import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

let client: SupabaseClient | null = null;

/**
 * Browser client using the public anon key. Every table and bucket is protected by
 * row-level security, so this key on its own grants access to nothing private.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Copy .env.example to .env.local.');
  if (!client) {
    client = createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}
