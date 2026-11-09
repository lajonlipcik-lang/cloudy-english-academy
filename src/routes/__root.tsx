import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
function NotFoundComponent() {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-7xl font-bold text-foreground">404</h1><h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2><p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p><div className="mt-6"><Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Go home</Link></div></div></div>;
}
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error); const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1><p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Try again</button><a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Go home</a></div></div></div>;
}
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
 staticData: { sitemap: false },
 head: () => ({
  meta: [
   { charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "google-site-verification", content: "Ry_Jj1RQYtx-Irq2DnRa_zniBie7GeAKBProavpbHE0" },
   { title: "Cloudy English Academy — учи английский каждый день" },
   { name: "description", content: "Изучай английский с короткими уроками, практикой и игровым прогрессом." },
   { name: "author", content: "Cloudy English Academy" }, { property: "og:site_name", content: "Cloudy English Academy" }, { name: "application-name", content: "Cloudy English Academy" }, { property: "og:title", content: "Cloudy English Academy" },
   { property: "og:description", content: "Твой дружелюбный помощник в изучении английского." }, { property: "og:type", content: "website" },
   { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:site", content: "@CloudyEnglish" },
   { name: "apple-mobile-web-app-capable", content: "yes" },
   { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
   { name: "apple-mobile-web-app-title", content: "Cloudy" }, { name: "theme-color", content: "#06143a" }
  ],
  links: [
   { rel: "stylesheet", href: appCss }, { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
   { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" }, { rel: "manifest", href: "/manifest.json" }
  ]
 }),
 shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent
});
function RootShell({ children }: { children: ReactNode }) {
 useEffect(() => {
  const applyLanguage = () => {
   let language: "ru" | "en" | "uk" = "ru";
   try {
    const prefs = JSON.parse(localStorage.getItem("cloudy-ui-v1") || "{}");
    if (prefs.lang === "en" || prefs.lang === "uk") language = prefs.lang;
   } catch {}
   document.documentElement.lang = language;
   document.title = language === "ru" ? "Cloudy English Academy — учи английский каждый день" : "Cloudy English Academy — Learn English every day";
   const description = language === "ru"
    ? "Изучай английский с короткими уроками, практикой и игровым прогрессом."
    : language === "uk"
     ? "Вивчай англійську з короткими уроками, практикою та ігровим прогресом."
     : "Learn English with short lessons, practice, and gamified progress.";
   document.querySelector('meta[name="description"]')?.setAttribute("content", description);
   const socialTitle = language === "ru"
    ? "Cloudy English Academy — учи английский каждый день"
    : language === "uk"
     ? "Cloudy English Academy — вивчай англійську щодня"
     : "Cloudy English Academy — Learn English every day";
   const socialDescription = language === "ru"
    ? "Уроки, упражнения и учебный прогресс в Cloudy English Academy."
    : language === "uk"
     ? "Уроки, вправи та навчальний прогрес у Cloudy English Academy."
     : "Lessons, exercises, and learning progress with Cloudy English Academy.";
   document.querySelector('meta[property="og:title"]')?.setAttribute("content", socialTitle);
   document.querySelector('meta[property="og:description"]')?.setAttribute("content", socialDescription);
   document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", socialTitle);
   document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", socialDescription);
  };
  applyLanguage();
  window.addEventListener("cloudy:languagechange", applyLanguage);
  window.addEventListener("storage", applyLanguage);
  const onMessage = (event: MessageEvent) => {
   if (event.origin === window.location.origin && event.data?.type === "cloudy:languagechange") { window.dispatchEvent(new CustomEvent("cloudy:languagechange")); }
  };
  window.addEventListener("message", onMessage);
  return () => {
   window.removeEventListener("cloudy:languagechange", applyLanguage);
   window.removeEventListener("storage", applyLanguage);
   window.removeEventListener("message", onMessage);
  };
 }, []);
 return <html lang="ru"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}
function RootComponent() { const { queryClient } = Route.useRouteContext(); return <QueryClientProvider client={queryClient}><Outlet /></QueryClientProvider>; }
