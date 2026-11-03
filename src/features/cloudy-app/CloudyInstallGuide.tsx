import { useEffect, useState } from "react";
import styles from "./CloudyInstallGuide.module.css";

type InstallEnvironment = { isAppleMobile: boolean; installed: boolean; safari: boolean };

export function isCloudyInstallRequired() {
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches;
  return appleMobile && !installed;
}

function readEnvironment(): InstallEnvironment {
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches;
  const safari = /Safari/i.test(navigator.userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i.test(navigator.userAgent);
  return { isAppleMobile: appleMobile, installed, safari };
}

function CloudyMascot() {
  return (
    <svg className={styles.mascot} viewBox="0 0 100 80" aria-hidden="true">
      <path d="M26 68a18 18 0 0 1-2-37 24 24 0 0 1 46-6 20 20 0 0 1 6 43z" fill="url(#gb)" />
      <g className="eyes">
        <circle cx="40" cy="45" r="5" fill="#06143a" />
        <circle cx="62" cy="45" r="5" fill="#06143a" />
        <circle cx="42" cy="43" r="1.8" fill="#fff" />
        <circle cx="64" cy="43" r="1.8" fill="#fff" />
      </g>
      <path d="M44 54q7 8 14 0" stroke="#06143a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="31" cy="55" r="4" fill="#ff9fb0" opacity=".55" />
      <circle cx="71" cy="55" r="4" fill="#ff9fb0" opacity=".55" />
    </svg>
  );
}

export function CloudyInstallGuide({ onInstalled }: { onInstalled: () => void }) {
  const [environment, setEnvironment] = useState<InstallEnvironment | null>(null);
  const [note, setNote] = useState("");
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    const refresh = () => setEnvironment(readEnvironment());
    refresh();
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const checkInstallation = () => {
    const current = readEnvironment();
    setEnvironment(current);
    if (current.installed) {
      try { localStorage.setItem("cloudyHomeInstalled", "1"); } catch { /* storage may be unavailable */ }
      onInstalled();
      return;
    }
    setNote("Пока Cloudy открыт во вкладке Safari. Вернись на главный экран iPhone и запусти Cloudy с новой иконки — тогда установка подтвердится.");
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
  };

  if (!environment || !environment.isAppleMobile || environment.installed) return null;

  return (
    <main className={styles.installGate}>
      <section className={`${styles.installPanel} ${shaking ? styles.shake : ""}`}>
        <div className={styles.installCloud}><CloudyMascot /></div>
        <h1 className={styles.installTitle}>Давай установим Cloudy!</h1>
        <p className={styles.installLead}>Добавь Cloudy на главный экран iPhone — и открывай его как настоящее приложение. Это займёт всего несколько секунд ☁️</p>
        <div className={styles.installSteps}>
          <div className={styles.installStep}>
            <span className={styles.installNumber}>1</span>
            <div><strong>Нажми «Поделиться»</strong><small>{environment.safari ? "Внизу Safari нажми квадрат со стрелкой вверх." : "Открой этот сайт в Safari, затем нажми квадрат со стрелкой вверх."}</small></div>
            <span className={styles.installShareIcon} aria-hidden="true">↥</span>
          </div>
          <div className={styles.installStep}>
            <span className={styles.installNumber}>2</span>
            <div><strong>Выбери «На экран Домой»</strong><small>Прокрути меню вниз, выбери этот пункт и оставь включённым «Открывать как веб-приложение», если появится переключатель.</small></div>
            <span className={styles.installShareIcon}>＋</span>
          </div>
          <div className={styles.installStep}>
            <span className={styles.installNumber}>3</span>
            <div><strong>Нажми «Добавить»</strong><small>Затем вернись на главный экран и открой иконку Cloudy.</small></div>
            <span className={styles.installShareIcon}>☁️</span>
          </div>
        </div>
        <p className={styles.installNote} aria-live="polite">{note || (environment.safari ? "После добавления открой Cloudy именно с главного экрана iPhone." : "Для установки потребуется Safari. Встроенный браузер приложения не поддерживает этот способ.")}</p>
        <button className={styles.installAction} onClick={checkInstallation}>Я добавил Cloudy — проверить</button>
        <span className={styles.installBrowser}>Cloudy English · Твой путь к английскому</span>
      </section>
    </main>
  );
}
