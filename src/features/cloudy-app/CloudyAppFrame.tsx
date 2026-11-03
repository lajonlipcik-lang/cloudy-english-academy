import { useEffect, useRef, useState } from "react";
import { CloudyInstallGuide, isCloudyInstallRequired } from "@/features/cloudy-app/CloudyInstallGuide";
import { useCloudyAppBridge } from "@/features/cloudy-app/useCloudyAppBridge";

export function CloudyAppFrame() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean | null>(null);
  useCloudyAppBridge(frameRef);

  useEffect(() => {
    const refreshInstallState = () => setShowInstallGuide(isCloudyInstallRequired());
    refreshInstallState();
    window.addEventListener("pageshow", refreshInstallState);
    window.addEventListener("focus", refreshInstallState);
    document.addEventListener("visibilitychange", refreshInstallState);
    return () => {
      window.removeEventListener("pageshow", refreshInstallState);
      window.removeEventListener("focus", refreshInstallState);
      document.removeEventListener("visibilitychange", refreshInstallState);
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
      {showInstallGuide === null ? null : showInstallGuide ? (
        <CloudyInstallGuide onInstalled={() => setShowInstallGuide(false)} />
      ) : (
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
      )}
    </main>
  );
}
