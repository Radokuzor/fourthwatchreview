import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
    return null;
  }
  if (!_admin) {
    _admin = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
