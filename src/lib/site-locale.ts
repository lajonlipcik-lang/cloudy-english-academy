export type SiteLanguage = "ru" | "en" | "uk";

const LANGUAGE_KEY = "cloudy-ui-v1";
const LANGUAGE_EVENT = "cloudy:languagechange";

export function getSiteLanguage(): SiteLanguage {
  if (typeof window === "undefined") return "ru";
  try {
    const stored = JSON.parse(window.localStorage.getItem(LANGUAGE_KEY) || "{}") as { lang?: string };
    return stored.lang === "en" || stored.lang === "uk" ? stored.lang : "ru";
  } catch {
    return "ru";
  }
}

export function subscribeSiteLanguage(listener: (language: SiteLanguage) => void): () => void {
  const update = () => listener(getSiteLanguage());
  window.addEventListener(LANGUAGE_EVENT, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, update);
    window.removeEventListener("storage", update);
  };
}

export function getSiteLanguageLabels(language: SiteLanguage) {
  return {
    ru: { language: "Русский", english: "English", ukrainian: "Українська" },
    en: { language: "Language", english: "English", ukrainian: "Ukrainian" },
    uk: { language: "Мова", english: "English", ukrainian: "Українська" },
  }[language];
}
