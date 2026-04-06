import { ENV } from "./_core/env";
import { getSupabaseAdmin } from "./_core/supabaseAdmin";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Supabase storage not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and create a public bucket (default name: uploads)"
    );
  }

  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);

  const bucket = ENV.supabaseStorageBucket;
  const { error } = await supabase.storage.from(bucket).upload(key, body, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
  return { key, url: pub.publicUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase storage not configured");
  }
  const key = normalizeKey(relKey);
  const bucket = ENV.supabaseStorageBucket;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
  return { key, url: pub.publicUrl };
}
