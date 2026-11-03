import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: CloudyOriginalApp });

function CloudyOriginalApp() {
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
