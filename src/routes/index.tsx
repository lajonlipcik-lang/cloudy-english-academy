import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ensureOwnerAdmin } from "@/lib/admin-role.functions";

type AuthRequest = {
  channel: "cloudy-auth";
  type: "request";
  id: string;
  action: "signUp" | "signIn" | "signOut";
  name?: string;
  email?: string;
  password?: string;
  state?: unknown;
};

function CloudyOriginalApp() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const send = (payload: Record<string, unknown>) => {
      frame.contentWindow?.postMessage({ channel: "cloudy-auth", ...payload }, window.location.origin);
    };

    const onMessage = async (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      if (!event.data || typeof event.data !== "object") return;
      const message = event.data as Partial<AuthRequest> & { channel?: string; type?: string };
      if (message.channel !== "cloudy-auth") return;

      if (message.type === "init") {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          send({ type: "session", ok: false, error: "Не удалось проверить сессию. Попробуйте обновить страницу." });
          return;
        }
        const user = data.session?.user;
        accessTokenRef.current = data.session?.access_token ?? null;
        let ownerIsAdmin = user?.app_metadata?.role === "admin";
        if (user?.email?.toLowerCase() === "lajonlipcik@gmail.com" && data.session?.access_token) { try { const role = await ensureOwnerAdmin({ data: { accessToken: data.session.access_token } }); ownerIsAdmin = role.isAdmin; } catch { console.error("[cloudy-admin] owner role refresh failed"); } }
        let progress: { state: Record<string, unknown>; updated_at: string } | null = null;
        if (user) {
          const { data: saved, error: progressError } = await supabase
            .from("user_progress")
            .select("state, updated_at")
            .eq("user_id", user.id)
            .maybeSingle();
          if (progressError) {
            // Keep the authenticated session even when the optional cloud snapshot is unavailable.
            send({ type: "session", ok: true, user: { id: user.id, email: user.email ?? "", name: String(user.user_metadata?.name ?? user.user_metadata?.display_name ?? ""), isAdmin: ownerIsAdmin || user.email?.toLowerCase() === "lajonlipcik@gmail.com" }, progress: null, progressWarning: "Не удалось загрузить облачный прогресс. Локальные данные сохранены." });
            return;
          }
          progress = saved;
        }
        send({
          type: "session",
          ok: true,
          user: user
            ? {
                id: user.id,
                email: user.email ?? "",
                name: String(user.user_metadata?.name ?? user.user_metadata?.display_name ?? ""),
                isAdmin: ownerIsAdmin || user.email?.toLowerCase() === "lajonlipcik@gmail.com",
              }
            : null,
          progress,
        });
        return;
      }

      if (message.type === "progress-save") {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) return;
        const state = message.state;
        if (!state || typeof state !== "object" || Array.isArray(state)) return;
        const record = state as Record<string, unknown>;
        const week = record.wk && typeof record.wk === "object" ? (record.wk as Record<string, unknown>) : {};
        const { error: saveError } = await supabase.from("user_progress").upsert(
          {
            user_id: authData.user.id,
            state: record,
            total_xp: Number(record.xp) || 0,
            week_key: typeof week.k === "string" ? week.k : "",
            week_xp: Number(week.xp) || 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (saveError) {
          send({ type: "progress-save-result", ok: false, error: "Не удалось сохранить прогресс в облако." });
        } else {
          send({ type: "progress-save-result", ok: true });
        }
        return;
      }

      if (message.type !== "request" || typeof message.id !== "string") return;
      const reply = (result: Record<string, unknown>) => send({ type: "response", id: message.id, ...result });

      try {
        const accessToken = accessTokenRef.current;
        if (["admin-users","admin-providers","admin-provider-save","admin-provider-delete","admin-provider-test","ai-chat"].includes(String(message.action))) {
          if (!accessToken) throw new Error("Сначала войдите в аккаунт.");
          const payload = { accessToken, ...(message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {}) };
          const api = await import("@/lib/cloudy-ai.functions");
          let result: unknown;
          if (message.action === "admin-users") result = await api.listCloudyUsers({ data: payload });
          else if (message.action === "admin-providers") result = await api.listAiProviders({ data: payload });
          else if (message.action === "admin-provider-save") result = await api.saveAiProvider({ data: payload as never });
          else if (message.action === "admin-provider-delete") result = await api.deleteAiProvider({ data: payload as never });
          else if (message.action === "admin-provider-test") result = await api.testAiProvider({ data: payload as never });
          else result = await api.cloudyTutorChat({ data: payload as never });
          reply({ ok: true, result }); return;
        }
        if (message.action === "signUp") {
          const { data, error } = await supabase.auth.signUp({
            email: String(message.email ?? "").trim().toLowerCase(),
            password: String(message.password ?? ""),
            options: { data: { name: String(message.name ?? "").trim() } },
          });
          if (error) throw error;
          if (!data.session || !data.user) {
            reply({ ok: true, needsConfirmation: true });
            return;
          }
          accessTokenRef.current = data.session.access_token;
          const role = await ensureOwnerAdmin({ data: { accessToken: data.session.access_token } });
          reply({
            ok: true,
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              name: String(data.user.user_metadata?.name ?? ""),
              isAdmin: role.isAdmin,
            },
          });
          return;
        }

        if (message.action === "signIn") {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: String(message.email ?? "").trim().toLowerCase(),
            password: String(message.password ?? ""),
          });
          if (error) throw error;
          accessTokenRef.current = data.session.access_token;
          const role = await ensureOwnerAdmin({ data: { accessToken: data.session.access_token } });
          reply({
            ok: true,
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              name: String(data.user.user_metadata?.name ?? data.user.user_metadata?.display_name ?? ""),
              isAdmin: role.isAdmin,
            },
          });
          return;
        }

        if (message.action === "signOut") {
          accessTokenRef.current = null;
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          reply({ ok: true });
          return;
        }
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Не удалось выполнить запрос.";
        reply({ ok: false, error: messageText });
      }
    };

    window.addEventListener("message", onMessage);
    const initialize = () => { const doc = frame.contentDocument; if (doc && !doc.getElementById("cloudy-admin-runtime")) { const script = doc.createElement("script"); script.id = "cloudy-admin-runtime"; script.src = "/cloudy-admin.js"; script.onload = () => send({ type: "init" }); doc.body.appendChild(script); } else send({ type: "init" }); };
    if (frame.contentDocument?.readyState === "complete") initialize();
    else frame.addEventListener("load", initialize, { once: true });

    return () => {
      window.removeEventListener("message", onMessage);
      frame.removeEventListener("load", initialize);
    };
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100dvh",
        minHeight: "100vh",
        overflow: "hidden",
        background: "#050d2b",
      }}
    >
      <iframe
        ref={frameRef}
        title="Cloudy English"
        src="/cloudy-english.html"
        allow="microphone"
        referrerPolicy="same-origin"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          background: "transparent",
        }}
      />
    </main>
  );
}

export const Route = createFileRoute("/")({ component: CloudyOriginalApp });
