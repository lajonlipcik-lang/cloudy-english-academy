import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let contentClient: SupabaseClient | undefined;

/**
 * Server-only client for the separate Cloudy Content Supabase project.
 * Core Auth must be validated before using this service-role client.
 * Never import this module from browser code or expose the service key.
 */
export function getCloudyContentAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("Cloudy Content database is available only on the server.");
  }

  if (contentClient) return contentClient;

  const url = process.env["CLOUDY_CONTENT_SUPABASE_URL"];
  const serviceRoleKey = process.env["CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Cloudy Content database is not configured. Set CLOUDY_CONTENT_SUPABASE_URL and CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  contentClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return contentClient;
}
