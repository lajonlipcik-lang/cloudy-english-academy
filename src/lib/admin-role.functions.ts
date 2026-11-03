import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const OWNER_EMAIL = "lajonlipcik@gmail.com";

export const ensureOwnerAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) {
      throw new Error("Unauthorized");
    }
    return { accessToken };
  })
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishableKey) {
      throw new Error("Admin role service is not configured");
    }

    const verifier = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: verified, error: verifyError } = await verifier.auth.getUser(data.accessToken);
    if (verifyError || !verified.user) throw new Error("Unauthorized");

    const email = (verified.user.email ?? "").trim().toLowerCase();
    if (email !== OWNER_EMAIL) return { isAdmin: verified.user.app_metadata?.["role"] === "admin" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
      verified.user.id,
      { app_metadata: { ...verified.user.app_metadata, role: "admin" } },
    );
    if (updateError || !updated.user) {
      console.error("[admin-role] Failed to assign owner role", updateError?.name ?? "unknown");
      throw new Error("Не удалось назначить роль администратора. Повторите попытку позже.");
    }
    return { isAdmin: updated.user.app_metadata?.["role"] === "admin" };
  });
