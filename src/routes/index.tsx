import { createFileRoute } from "@tanstack/react-router";
import { CloudyAppFrame } from "@/features/cloudy-app/CloudyAppFrame";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({ meta: [
    { title: "Cloudy English Academy — учи английский каждый день" },
    { name: "description", content: "Изучай английский A1–B2 с уроками, упражнениями и помощником Cloudy AI." },
    { property: "og:title", content: "Cloudy English Academy — английский A1–B2" },
    { property: "og:description", content: "Уроки, упражнения и учебный прогресс в Cloudy English Academy." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { property: "og:url", content: "https://cloudyenglishru.lovable.app/" },
  ],
  links: [{ rel: "canonical", href: "https://cloudyenglishru.lovable.app/" }],
  scripts: [{
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Cloudy English Academy",
      alternateName: ["Cloudy English", "Cloudy"],
      url: "https://cloudyenglishru.lovable.app/",
    }),
  }] }),
  component: CloudyAppFrame,
});
