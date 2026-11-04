import { useEffect, useRef, useState } from "react";
import { CloudyInstallGuide, isCloudyInstallRequired } from "@/features/cloudy-app/CloudyInstallGuide";
import { useCloudyAppBridge } from "@/features/cloudy-app/useCloudyAppBridge";

type RegionAccessState = "checking" | "allowed" | "unavailable";

export function CloudyAppFrame() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean | null>(null);
  const [regionAccess, setRegionAccess] = useState<RegionAccessState>("checking");
  useCloudyAppBridge(frameRef);

  useEffect(() => {
    let disposed = false;
    let checkInProgress = false;

    const refreshInstallState = () => setShowInstallGuide(isCloudyInstallRequired());

    const verifyRegionAccess = async () => {
      if (checkInProgress || disposed) return;
      checkInProgress = true;
      setRegionAccess("checking");

      try {
        // A full-document HEAD request reaches the same server-side country gate.
        // This also covers SPA navigation and pages restored from the iOS back-forward cache.
        const response = await fetch("/", { method: "HEAD", cache: "no-store" });
        if (disposed) return;

        if (response.status === 403) {
          // Reload through the server so the branded regional availability page is rendered.
          window.location.replace("/");
          return;
        }

        setRegionAccess(response.ok ? "allowed" : "unavailable");
      } catch {
        if (!disposed) setRegionAccess("unavailable");
      } finally {
        checkInProgress = false;
      }
    };

    const refreshOnVisible = () => {
      refreshInstallState();
      if (document.visibilityState === "visible") void verifyRegionAccess();
    };

    refreshInstallState();
    void verifyRegionAccess();
    window.addEventListener("pageshow", refreshOnVisible);
    window.addEventListener("focus", refreshOnVisible);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      disposed = true;
      window.removeEventListener("pageshow", refreshOnVisible);
      window.removeEventListener("focus", refreshOnVisible);
      document.removeEventListener("visibilitychange", refreshOnVisible);
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
      {regionAccess === "allowed" && (
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
            visibility: showInstallGuide === false ? "visible" : "hidden",
          }}
        />
      )}
      {regionAccess === "allowed" && showInstallGuide === true && (
        <CloudyInstallGuide onInstalled={() => setShowInstallGuide(false)} />
      )}
      {regionAccess === "unavailable" && (
        <section
          role="status"
          style={{
            display: "grid",
            minHeight: "100%",
            placeContent: "center",
            gap: 12,
            padding: 24,
            color: "#e8f5ff",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p>Не удалось проверить доступность сервиса.</p>
          <p style={{ color: "#a7c4df", fontSize: 14 }}>Проверьте подключение к интернету и повторите попытку.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              justifySelf: "center",
              minHeight: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 12,
              color: "#fff",
              fontWeight: 700,
              background: "linear-gradient(100deg, #55baff, #2879e8)",
            }}
          >
            Повторить проверку
          </button>
        </section>
      )}
    </main>
  );
}
