import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-rest";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) {
    throw new Error("Supabase no esta configurado.");
  }

  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
