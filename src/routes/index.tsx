import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type AuthRequest = {
  channel: "cloudy-auth";
  type: "request";
  id: string;
  action: "signUp" | "signIn" | "signOut";
  name?: string;
  email?: string;
  password?: string;
};

function CloudyOriginalApp() {
  const frameRef = useRef<HTMLIFrameElement>(null);

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
        send({
          type: "session",
          ok: true,
          user: user
            ? {
                id: user.id,
                email: user.email ?? "",
                name: String(user.user_metadata?.name ?? user.user_metadata?.display_name ?? ""),
              }
            : null,
        });
        return;
      }

      if (message.type !== "request" || typeof message.id !== "string") return;
      const reply = (result: Record<string, unknown>) => send({ type: "response", id: message.id, ...result });

      try {
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
          reply({
            ok: true,
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              name: String(data.user.user_metadata?.name ?? ""),
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
          reply({
            ok: true,
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              name: String(data.user.user_metadata?.name ?? data.user.user_metadata?.display_name ?? ""),
            },
          });
          return;
        }

        if (message.action === "signOut") {
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
    const initialize = () => send({ type: "init" });
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
