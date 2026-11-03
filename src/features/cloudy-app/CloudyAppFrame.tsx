import { useRef } from "react";
import { useCloudyAppBridge } from "@/features/cloudy-app/useCloudyAppBridge";

export function CloudyAppFrame() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  useCloudyAppBridge(frameRef);

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
